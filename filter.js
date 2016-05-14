var stream = require("stream");
var os = require("os");
const EOL = os.EOL

const SERIAL = 0;
const TIMELINE = 1;
const TEXT = 2;


Filter.prototype.nextTurn = function() {
	this.turn++;
}

Filter.prototype.resetTurn = function() {
	this.turn = SERIAL;
}


function Filter(opts) {
	stream.Transform.call(this, {
		decodeStrings: false,
	});

	this.config = {
		timeBlock: 8000,
	};
	Object.assign(this.config, opts);

	this.pendingText = "";
	this.lastTimeMark = 0;
	this.pristine = true;
	this.resetTurn();

}


Filter.prototype.processLine = function(line) {

	if (!line) return;

	var text = this.pendingText ? (this.pendingText + " " + line) : line;

	text = unwrap(text);
	text = text.trim();

	var end = this.shouldEnd(text);

	if (!end) {
		this.pendingText = text;
		return;
	}

	// we only do time determination with the first line of the same timespan 
	// (other lines will have a larger `turn`)
	if (!this.pristine && this.config.timeBlock && this.turn == TEXT &&
		this.timePassed > this.config.timeBlock) {
		text = EOL + EOL + text
	}

	this.pendingText = text;
	this.flushText();

};

Filter.prototype.flushText = function() {
	// TODO: considering appending EOL instead of prepending,
	// would have more flexibility
	var text = this.pristine ? this.pendingText : (EOL + EOL + this.pendingText)

	this.push(text);
	this.pendingText = ''
	if (this.pristine) this.pristine = false;
};

function toMs(h, m, s, ms) {
	return (+h * 3600 + +m * 60 + +s) * 1000 + +ms
}

const RE_TIME = /(\d+):(\d+):(\d+),(\d+)/
Filter.prototype.processTime = function(line) {
	var err;

	var timeSpan = line.split('-->')
		.map(function(str) {
			var arr = str.match(RE_TIME)
			if (!arr || arr.length != 5) {
				err = true;
				return
			}
			arr.shift()
			return toMs.apply(null, arr)
		})
		// if there is any parsing error, we simply do nothing.
	if (err) return;
	this.timePassed = timeSpan[0] - this.lastTimeMark;
	this.lastTimeMark = timeSpan[1];
};

// already trimmed
Filter.prototype.shouldEnd = function (text) {

	if(this.pristine && metaLike(text)) return true;  

	var last = text[text.length - 1];
	if (last == ',') return false

	var hasDot = endWithMark(text);
	var interrupted = endWithDashes(text);
	return hasDot || interrupted;
}


const RE_URL = /\S+\.com/;
// return true only when "by" and url-like string both appear.
function metaLike (text) {
	var by = text.includes('by');
	var urlLike = RE_URL.test(text);
	return by && urlLike;
}

function isEmpty(str) {
	return str === '';
}

function endWithMark(str) {
	var letter = str[str.length - 1]
	return letter == '.' || letter == '?';
}

const RE_DASHES_END = /--$/;

function endWithDashes(str) {
	return RE_DASHES_END.test(str);
}

// NOTE: does not take into account of nested brackets
const RE_UNWRAP = /<(\S+)(?:\s+[^>]*)?>(.*?)<\/\1>/g

function unwrap(str) {
	return str.replace(RE_UNWRAP, function(match, p1, p2) {
		return p2;
	})
}


Filter.prototype._transform = function(line, enc, next) {

	if (isEmpty(line)) {
		this.resetTurn()
		next();
		return;
	}

	if (this.turn === SERIAL) {} else if (this.turn === TIMELINE) {
		this.processTime(line);
	} else if (this.turn >= TEXT) {
		this.processLine(line);

	}

	this.nextTurn();
	next();
}

Filter.prototype._flush = function(cb) {

	this.flushText();
	cb();
}

require("util").inherits(Filter, stream.Transform)

module.exports = Filter