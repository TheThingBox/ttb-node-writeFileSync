module.exports = function(RED) {
  "use strict";
  var fs = require("fs-extra");
  var os = require("os");
  var path = require("path");

  function FileNode(n) {
    RED.nodes.createNode(this,n);
    this.filename = n.filename;
    this.appendNewline = n.appendNewline;
    this.overwriteFile = n.overwriteFile.toString();
    this.createDir = n.createDir || false;
    var node = this;
    node.wstream = null;
    node.data = [];

    this.on("input",function(msg) {
      var filename = node.filename || msg.filename || "";
      if ((!node.filename) && (!node.tout)) {
        node.tout = setTimeout(function() {
          node.status({fill:"grey",shape:"dot",text:filename});
          clearTimeout(node.tout);
          node.tout = null;
        },333);
      }
      if (filename === "") { node.warn(RED._("node-red:file.errors.nofilename")); }
      else if (node.overwriteFile === "delete") {
        fs.unlink(filename, function (err) {
          if (err) { node.error(RED._("node-red:file.errors.deletefail",{error:err.toString()}),msg); }
          else if (RED.settings.verbose) { node.log(RED._("file.status.deletedfile",{file:filename})); }
        });
      }
      else if (msg.hasOwnProperty("payload") && (typeof msg.payload !== "undefined")) {
        var dir = path.dirname(filename);
        if (node.createDir) {
          fs.ensureDir(dir, function(err) {
            if (err) { node.error(RED._("node-red:file.errors.createfail",{error:err.toString()}),msg); }
          });
        }

        var data = msg.payload;
        if ((typeof data === "object") && (!Buffer.isBuffer(data))) {
          data = JSON.stringify(data);
        }
        if (typeof data === "boolean") { data = data.toString(); }
        if (typeof data === "number") { data = data.toString(); }
        if ((this.appendNewline) && (!Buffer.isBuffer(data))) { data += os.EOL; }
        node.data.push(Buffer.from(data));

        while (node.data.length > 0) {
          if (this.overwriteFile === "true") {
            node.wstream = fs.createWriteStream(filename, { encoding:'binary', flags:'w', autoClose:true });
            node.wstream.on("error", function(err) {
              node.error(RED._("node-red:file.errors.writefail",{error:err.toString()}),msg);
            });
            node.wstream.end(node.data.shift(), function(){ node.send(msg); });
          }
          else {
            if ((!node.wstream) || (!node.filename)) {
              node.wstream = fs.createWriteStream(filename, { encoding:'binary', flags:'a', autoClose:true });
              node.wstream.on("error", function(err) {
                node.error(RED._("node-red:file.errors.appendfail",{error:err.toString()}),msg);
              });
            }
            if (node.filename) { node.wstream.write(node.data.shift(), function(){ node.send(msg); }); }
            else { node.wstream.end(node.data.shift(), function(){ node.send(msg); }); }
          }
        }
      }
    });
    this.on('close', function() {
      if (node.wstream) { node.wstream.end(); }
      if (node.tout) { clearTimeout(node.tout); }
      node.status({});
    });
  }
  RED.nodes.registerType("ttb-node-writeFileSync",FileNode);
}
