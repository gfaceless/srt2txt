var stream = require("stream");
var os = require("os");
const EOL = os.EOL

const TURN_SERIAL = 0;
const TURN_TIMELINE = 1;
const TURN_TEXT = 2;

const CONCAT_SYMBOLS = ['...']

Filter.prototype = {
  constructor: Filter,
  processLine,
  processTime,
  _nextTurn,
  _resetTurn,
  _flushText,
  _tryEndBlock
}

function _nextTurn() {
  this.turn++;
}

function _resetTurn() {
  this.turn = TURN_SERIAL;
}


function Filter(opts) {
  stream.Transform.call(this, {
    decodeStrings: false,
  });

  this.config = {
    timeBlock: 8000,
  };
  Object.assign(this.config, opts);

  this._pendingText = "";
  this.lastTimeMark = 0;
  this.pristine = true;
  this._resetTurn();

}


function processLine(line) {

  if (!line) return;

  //////////////
  // left end //
  //////////////

  if (this._pendingText) {
    if (this._lastConcatSymbol && line.startsWith(this._lastConcatSymbol)) {

      let len = this._lastConcatSymbol.length;
      // TODO: utils are not necessary
      this._pendingText = cutTail(this._pendingText, len)
      line = cutHead(line, len)
    }
    this._pendingText += " " + line;
  } else {
    this._pendingText = line;
  }

  // basic processing
  this._pendingText = unwrap(this._pendingText);
  this._pendingText = this._pendingText.trim();

  ///////////////
  // right end //
  ///////////////
  this._lastConcatSymbol = CONCAT_SYMBOLS.find((symbol, i) => {
    return line.endsWith(symbol)
  })

  this._tryEndBlock();
};

function _tryEndBlock() {
  // by default we do not end this block.
  if (
    (this.pristine && metaLike(this._pendingText)) ||
    endWithMark(this._pendingText) ||
    endWithDashes(this._pendingText)
  ) {
    this._flushText();
  }

}

function _flushText() {

  // if some time block is passed, we seperate passages with a wider gap.
  if (!this.pristine && this.config.timeBlock && this.turn == TURN_TEXT &&
    this.timePassed > this.config.timeBlock) {
    this._pendingText = EOL + EOL + this._pendingText
  }

  // TODO: considering appending EOL instead of prepending,
  // would have more flexibility
  var text = this.pristine ? this._pendingText : (EOL + EOL + this._pendingText)

  this._pendingText = ''
  if (this.pristine) this.pristine = false;
  this.push(text);
};

function toMs(h, m, s, ms) {
  return (+h * 3600 + +m * 60 + +s) * 1000 + +ms
}

const RE_TIME = /(\d+):(\d+):(\d+),(\d+)/
function processTime(line) {
  var err;

  var timeSpan = line.split('-->')
    .map(function(str) {
      var arr = str.match(RE_TIME)
      if (!arr || arr.length != 5) {
        err = true;
        return
      }
      arr.shift()
      return toMs(...arr)
    })
    // if there is any parsing error, we simply do nothing.
  if (err) return;
  this.timePassed = timeSpan[0] - this.lastTimeMark;
  this.lastTimeMark = timeSpan[1];
};



const RE_URL = /\S+\.com/;
// return true only when "by" and url-like string both appear.
function metaLike(text) {
  var by = text.includes('by');
  var urlLike = RE_URL.test(text);
  return by && urlLike;
}

function isEmpty(str) {
  return str === '';
}


function endWithMark(str) {
	// return `false` if end with any concatenation symbol
  var endWithConcat = CONCAT_SYMBOLS.some(sym => {
    return str.endsWith(sym);
  })
  if (endWithConcat) return false;

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
    this._resetTurn()
    next();
    return;
  }

  if (this.turn === TURN_SERIAL) {} else if (this.turn === TURN_TIMELINE) {
    this.processTime(line);
  } else if (this.turn >= TURN_TEXT) {
    this.processLine(line);
  }

  this._nextTurn();
  next();
}

Filter.prototype._flush = function(cb) {

  this._flushText();
  cb();
}

require("util").inherits(Filter, stream.Transform)

module.exports = Filter


///////////
// UTILS //
///////////

function cutHead(str, len) {
  return str.substring(len)
}

function cutTail(str, len) {
  return str.substring(0, str.length - len);
}
