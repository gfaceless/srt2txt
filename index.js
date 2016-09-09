#!/usr/bin/env node

var fs = require("fs");

var stream = require("stream");
var split = require("split2");
var Filter = require("./filter");

var argv = require('yargs').argv;
var filePath = argv._[0];


function Converter(options) {
	if (!(this instanceof Converter)) return new Converter(options);
	var filter = new Filter();
	var spliter = split();
	this.on('pipe', function(source) {
		source.unpipe(this);
		// TODO: add error control here
		this.transformStream = source.pipe(spliter).pipe(filter);
	});
}
require("util").inherits(Converter, stream.PassThrough)

Converter.prototype.pipe = function(destination, options) {
	return this.transformStream.pipe(destination, options);
};


fs.createReadStream(filePath)
	.pipe(Converter())
	.pipe(process.stdout);
	// .pipe(fs.createWriteStream('./2.txt'));
