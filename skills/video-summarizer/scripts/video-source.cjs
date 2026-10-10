"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/qrcode/lib/can-promise.js
var require_can_promise = __commonJS({
  "node_modules/qrcode/lib/can-promise.js"(exports2, module2) {
    module2.exports = function() {
      return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
    };
  }
});

// node_modules/qrcode/lib/core/utils.js
var require_utils = __commonJS({
  "node_modules/qrcode/lib/core/utils.js"(exports2) {
    var toSJISFunction;
    var CODEWORDS_COUNT = [
      0,
      // Not used
      26,
      44,
      70,
      100,
      134,
      172,
      196,
      242,
      292,
      346,
      404,
      466,
      532,
      581,
      655,
      733,
      815,
      901,
      991,
      1085,
      1156,
      1258,
      1364,
      1474,
      1588,
      1706,
      1828,
      1921,
      2051,
      2185,
      2323,
      2465,
      2611,
      2761,
      2876,
      3034,
      3196,
      3362,
      3532,
      3706
    ];
    exports2.getSymbolSize = function getSymbolSize(version) {
      if (!version) throw new Error('"version" cannot be null or undefined');
      if (version < 1 || version > 40) throw new Error('"version" should be in range from 1 to 40');
      return version * 4 + 17;
    };
    exports2.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
      return CODEWORDS_COUNT[version];
    };
    exports2.getBCHDigit = function(data) {
      let digit = 0;
      while (data !== 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    };
    exports2.setToSJISFunction = function setToSJISFunction(f) {
      if (typeof f !== "function") {
        throw new Error('"toSJISFunc" is not a valid function.');
      }
      toSJISFunction = f;
    };
    exports2.isKanjiModeEnabled = function() {
      return typeof toSJISFunction !== "undefined";
    };
    exports2.toSJIS = function toSJIS(kanji) {
      return toSJISFunction(kanji);
    };
  }
});

// node_modules/qrcode/lib/core/error-correction-level.js
var require_error_correction_level = __commonJS({
  "node_modules/qrcode/lib/core/error-correction-level.js"(exports2) {
    exports2.L = { bit: 1 };
    exports2.M = { bit: 0 };
    exports2.Q = { bit: 3 };
    exports2.H = { bit: 2 };
    function fromString(string) {
      if (typeof string !== "string") {
        throw new Error("Param is not a string");
      }
      const lcStr = string.toLowerCase();
      switch (lcStr) {
        case "l":
        case "low":
          return exports2.L;
        case "m":
        case "medium":
          return exports2.M;
        case "q":
        case "quartile":
          return exports2.Q;
        case "h":
        case "high":
          return exports2.H;
        default:
          throw new Error("Unknown EC Level: " + string);
      }
    }
    exports2.isValid = function isValid(level) {
      return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
    };
    exports2.from = function from(value, defaultValue) {
      if (exports2.isValid(value)) {
        return value;
      }
      try {
        return fromString(value);
      } catch (e) {
        return defaultValue;
      }
    };
  }
});

// node_modules/qrcode/lib/core/bit-buffer.js
var require_bit_buffer = __commonJS({
  "node_modules/qrcode/lib/core/bit-buffer.js"(exports2, module2) {
    function BitBuffer() {
      this.buffer = [];
      this.length = 0;
    }
    BitBuffer.prototype = {
      get: function(index) {
        const bufIndex = Math.floor(index / 8);
        return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
      },
      put: function(num, length) {
        for (let i = 0; i < length; i++) {
          this.putBit((num >>> length - i - 1 & 1) === 1);
        }
      },
      getLengthInBits: function() {
        return this.length;
      },
      putBit: function(bit) {
        const bufIndex = Math.floor(this.length / 8);
        if (this.buffer.length <= bufIndex) {
          this.buffer.push(0);
        }
        if (bit) {
          this.buffer[bufIndex] |= 128 >>> this.length % 8;
        }
        this.length++;
      }
    };
    module2.exports = BitBuffer;
  }
});

// node_modules/qrcode/lib/core/bit-matrix.js
var require_bit_matrix = __commonJS({
  "node_modules/qrcode/lib/core/bit-matrix.js"(exports2, module2) {
    function BitMatrix(size) {
      if (!size || size < 1) {
        throw new Error("BitMatrix size must be defined and greater than 0");
      }
      this.size = size;
      this.data = new Uint8Array(size * size);
      this.reservedBit = new Uint8Array(size * size);
    }
    BitMatrix.prototype.set = function(row, col, value, reserved) {
      const index = row * this.size + col;
      this.data[index] = value;
      if (reserved) this.reservedBit[index] = true;
    };
    BitMatrix.prototype.get = function(row, col) {
      return this.data[row * this.size + col];
    };
    BitMatrix.prototype.xor = function(row, col, value) {
      this.data[row * this.size + col] ^= value;
    };
    BitMatrix.prototype.isReserved = function(row, col) {
      return this.reservedBit[row * this.size + col];
    };
    module2.exports = BitMatrix;
  }
});

// node_modules/qrcode/lib/core/alignment-pattern.js
var require_alignment_pattern = __commonJS({
  "node_modules/qrcode/lib/core/alignment-pattern.js"(exports2) {
    var getSymbolSize = require_utils().getSymbolSize;
    exports2.getRowColCoords = function getRowColCoords(version) {
      if (version === 1) return [];
      const posCount = Math.floor(version / 7) + 2;
      const size = getSymbolSize(version);
      const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
      const positions = [size - 7];
      for (let i = 1; i < posCount - 1; i++) {
        positions[i] = positions[i - 1] - intervals;
      }
      positions.push(6);
      return positions.reverse();
    };
    exports2.getPositions = function getPositions(version) {
      const coords = [];
      const pos = exports2.getRowColCoords(version);
      const posLength = pos.length;
      for (let i = 0; i < posLength; i++) {
        for (let j = 0; j < posLength; j++) {
          if (i === 0 && j === 0 || // top-left
          i === 0 && j === posLength - 1 || // bottom-left
          i === posLength - 1 && j === 0) {
            continue;
          }
          coords.push([pos[i], pos[j]]);
        }
      }
      return coords;
    };
  }
});

// node_modules/qrcode/lib/core/finder-pattern.js
var require_finder_pattern = __commonJS({
  "node_modules/qrcode/lib/core/finder-pattern.js"(exports2) {
    var getSymbolSize = require_utils().getSymbolSize;
    var FINDER_PATTERN_SIZE = 7;
    exports2.getPositions = function getPositions(version) {
      const size = getSymbolSize(version);
      return [
        // top-left
        [0, 0],
        // top-right
        [size - FINDER_PATTERN_SIZE, 0],
        // bottom-left
        [0, size - FINDER_PATTERN_SIZE]
      ];
    };
  }
});

// node_modules/qrcode/lib/core/mask-pattern.js
var require_mask_pattern = __commonJS({
  "node_modules/qrcode/lib/core/mask-pattern.js"(exports2) {
    exports2.Patterns = {
      PATTERN000: 0,
      PATTERN001: 1,
      PATTERN010: 2,
      PATTERN011: 3,
      PATTERN100: 4,
      PATTERN101: 5,
      PATTERN110: 6,
      PATTERN111: 7
    };
    var PenaltyScores = {
      N1: 3,
      N2: 3,
      N3: 40,
      N4: 10
    };
    exports2.isValid = function isValid(mask) {
      return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
    };
    exports2.from = function from(value) {
      return exports2.isValid(value) ? parseInt(value, 10) : void 0;
    };
    exports2.getPenaltyN1 = function getPenaltyN1(data) {
      const size = data.size;
      let points = 0;
      let sameCountCol = 0;
      let sameCountRow = 0;
      let lastCol = null;
      let lastRow = null;
      for (let row = 0; row < size; row++) {
        sameCountCol = sameCountRow = 0;
        lastCol = lastRow = null;
        for (let col = 0; col < size; col++) {
          let module3 = data.get(row, col);
          if (module3 === lastCol) {
            sameCountCol++;
          } else {
            if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
            lastCol = module3;
            sameCountCol = 1;
          }
          module3 = data.get(col, row);
          if (module3 === lastRow) {
            sameCountRow++;
          } else {
            if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
            lastRow = module3;
            sameCountRow = 1;
          }
        }
        if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
        if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
      }
      return points;
    };
    exports2.getPenaltyN2 = function getPenaltyN2(data) {
      const size = data.size;
      let points = 0;
      for (let row = 0; row < size - 1; row++) {
        for (let col = 0; col < size - 1; col++) {
          const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
          if (last === 4 || last === 0) points++;
        }
      }
      return points * PenaltyScores.N2;
    };
    exports2.getPenaltyN3 = function getPenaltyN3(data) {
      const size = data.size;
      let points = 0;
      let bitsCol = 0;
      let bitsRow = 0;
      for (let row = 0; row < size; row++) {
        bitsCol = bitsRow = 0;
        for (let col = 0; col < size; col++) {
          bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
          if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
          bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
          if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
        }
      }
      return points * PenaltyScores.N3;
    };
    exports2.getPenaltyN4 = function getPenaltyN4(data) {
      let darkCount = 0;
      const modulesCount = data.data.length;
      for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
      const k = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
      return k * PenaltyScores.N4;
    };
    function getMaskAt(maskPattern, i, j) {
      switch (maskPattern) {
        case exports2.Patterns.PATTERN000:
          return (i + j) % 2 === 0;
        case exports2.Patterns.PATTERN001:
          return i % 2 === 0;
        case exports2.Patterns.PATTERN010:
          return j % 3 === 0;
        case exports2.Patterns.PATTERN011:
          return (i + j) % 3 === 0;
        case exports2.Patterns.PATTERN100:
          return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case exports2.Patterns.PATTERN101:
          return i * j % 2 + i * j % 3 === 0;
        case exports2.Patterns.PATTERN110:
          return (i * j % 2 + i * j % 3) % 2 === 0;
        case exports2.Patterns.PATTERN111:
          return (i * j % 3 + (i + j) % 2) % 2 === 0;
        default:
          throw new Error("bad maskPattern:" + maskPattern);
      }
    }
    exports2.applyMask = function applyMask(pattern, data) {
      const size = data.size;
      for (let col = 0; col < size; col++) {
        for (let row = 0; row < size; row++) {
          if (data.isReserved(row, col)) continue;
          data.xor(row, col, getMaskAt(pattern, row, col));
        }
      }
    };
    exports2.getBestMask = function getBestMask(data, setupFormatFunc) {
      const numPatterns = Object.keys(exports2.Patterns).length;
      let bestPattern = 0;
      let lowerPenalty = Infinity;
      for (let p = 0; p < numPatterns; p++) {
        setupFormatFunc(p);
        exports2.applyMask(p, data);
        const penalty = exports2.getPenaltyN1(data) + exports2.getPenaltyN2(data) + exports2.getPenaltyN3(data) + exports2.getPenaltyN4(data);
        exports2.applyMask(p, data);
        if (penalty < lowerPenalty) {
          lowerPenalty = penalty;
          bestPattern = p;
        }
      }
      return bestPattern;
    };
  }
});

// node_modules/qrcode/lib/core/error-correction-code.js
var require_error_correction_code = __commonJS({
  "node_modules/qrcode/lib/core/error-correction-code.js"(exports2) {
    var ECLevel = require_error_correction_level();
    var EC_BLOCKS_TABLE = [
      // L  M  Q  H
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      2,
      2,
      1,
      2,
      2,
      4,
      1,
      2,
      4,
      4,
      2,
      4,
      4,
      4,
      2,
      4,
      6,
      5,
      2,
      4,
      6,
      6,
      2,
      5,
      8,
      8,
      4,
      5,
      8,
      8,
      4,
      5,
      8,
      11,
      4,
      8,
      10,
      11,
      4,
      9,
      12,
      16,
      4,
      9,
      16,
      16,
      6,
      10,
      12,
      18,
      6,
      10,
      17,
      16,
      6,
      11,
      16,
      19,
      6,
      13,
      18,
      21,
      7,
      14,
      21,
      25,
      8,
      16,
      20,
      25,
      8,
      17,
      23,
      25,
      9,
      17,
      23,
      34,
      9,
      18,
      25,
      30,
      10,
      20,
      27,
      32,
      12,
      21,
      29,
      35,
      12,
      23,
      34,
      37,
      12,
      25,
      34,
      40,
      13,
      26,
      35,
      42,
      14,
      28,
      38,
      45,
      15,
      29,
      40,
      48,
      16,
      31,
      43,
      51,
      17,
      33,
      45,
      54,
      18,
      35,
      48,
      57,
      19,
      37,
      51,
      60,
      19,
      38,
      53,
      63,
      20,
      40,
      56,
      66,
      21,
      43,
      59,
      70,
      22,
      45,
      62,
      74,
      24,
      47,
      65,
      77,
      25,
      49,
      68,
      81
    ];
    var EC_CODEWORDS_TABLE = [
      // L  M  Q  H
      7,
      10,
      13,
      17,
      10,
      16,
      22,
      28,
      15,
      26,
      36,
      44,
      20,
      36,
      52,
      64,
      26,
      48,
      72,
      88,
      36,
      64,
      96,
      112,
      40,
      72,
      108,
      130,
      48,
      88,
      132,
      156,
      60,
      110,
      160,
      192,
      72,
      130,
      192,
      224,
      80,
      150,
      224,
      264,
      96,
      176,
      260,
      308,
      104,
      198,
      288,
      352,
      120,
      216,
      320,
      384,
      132,
      240,
      360,
      432,
      144,
      280,
      408,
      480,
      168,
      308,
      448,
      532,
      180,
      338,
      504,
      588,
      196,
      364,
      546,
      650,
      224,
      416,
      600,
      700,
      224,
      442,
      644,
      750,
      252,
      476,
      690,
      816,
      270,
      504,
      750,
      900,
      300,
      560,
      810,
      960,
      312,
      588,
      870,
      1050,
      336,
      644,
      952,
      1110,
      360,
      700,
      1020,
      1200,
      390,
      728,
      1050,
      1260,
      420,
      784,
      1140,
      1350,
      450,
      812,
      1200,
      1440,
      480,
      868,
      1290,
      1530,
      510,
      924,
      1350,
      1620,
      540,
      980,
      1440,
      1710,
      570,
      1036,
      1530,
      1800,
      570,
      1064,
      1590,
      1890,
      600,
      1120,
      1680,
      1980,
      630,
      1204,
      1770,
      2100,
      660,
      1260,
      1860,
      2220,
      720,
      1316,
      1950,
      2310,
      750,
      1372,
      2040,
      2430
    ];
    exports2.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case ECLevel.L:
          return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
        case ECLevel.M:
          return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
        case ECLevel.Q:
          return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
        case ECLevel.H:
          return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
        default:
          return void 0;
      }
    };
    exports2.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case ECLevel.L:
          return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
        case ECLevel.M:
          return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
        case ECLevel.Q:
          return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
        case ECLevel.H:
          return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
        default:
          return void 0;
      }
    };
  }
});

// node_modules/qrcode/lib/core/galois-field.js
var require_galois_field = __commonJS({
  "node_modules/qrcode/lib/core/galois-field.js"(exports2) {
    var EXP_TABLE = new Uint8Array(512);
    var LOG_TABLE = new Uint8Array(256);
    (function initTables() {
      let x = 1;
      for (let i = 0; i < 255; i++) {
        EXP_TABLE[i] = x;
        LOG_TABLE[x] = i;
        x <<= 1;
        if (x & 256) {
          x ^= 285;
        }
      }
      for (let i = 255; i < 512; i++) {
        EXP_TABLE[i] = EXP_TABLE[i - 255];
      }
    })();
    exports2.log = function log(n) {
      if (n < 1) throw new Error("log(" + n + ")");
      return LOG_TABLE[n];
    };
    exports2.exp = function exp(n) {
      return EXP_TABLE[n];
    };
    exports2.mul = function mul(x, y) {
      if (x === 0 || y === 0) return 0;
      return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
    };
  }
});

// node_modules/qrcode/lib/core/polynomial.js
var require_polynomial = __commonJS({
  "node_modules/qrcode/lib/core/polynomial.js"(exports2) {
    var GF = require_galois_field();
    exports2.mul = function mul(p1, p2) {
      const coeff = new Uint8Array(p1.length + p2.length - 1);
      for (let i = 0; i < p1.length; i++) {
        for (let j = 0; j < p2.length; j++) {
          coeff[i + j] ^= GF.mul(p1[i], p2[j]);
        }
      }
      return coeff;
    };
    exports2.mod = function mod(divident, divisor) {
      let result = new Uint8Array(divident);
      while (result.length - divisor.length >= 0) {
        const coeff = result[0];
        for (let i = 0; i < divisor.length; i++) {
          result[i] ^= GF.mul(divisor[i], coeff);
        }
        let offset = 0;
        while (offset < result.length && result[offset] === 0) offset++;
        result = result.slice(offset);
      }
      return result;
    };
    exports2.generateECPolynomial = function generateECPolynomial(degree) {
      let poly = new Uint8Array([1]);
      for (let i = 0; i < degree; i++) {
        poly = exports2.mul(poly, new Uint8Array([1, GF.exp(i)]));
      }
      return poly;
    };
  }
});

// node_modules/qrcode/lib/core/reed-solomon-encoder.js
var require_reed_solomon_encoder = __commonJS({
  "node_modules/qrcode/lib/core/reed-solomon-encoder.js"(exports2, module2) {
    var Polynomial = require_polynomial();
    function ReedSolomonEncoder(degree) {
      this.genPoly = void 0;
      this.degree = degree;
      if (this.degree) this.initialize(this.degree);
    }
    ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
      this.degree = degree;
      this.genPoly = Polynomial.generateECPolynomial(this.degree);
    };
    ReedSolomonEncoder.prototype.encode = function encode(data) {
      if (!this.genPoly) {
        throw new Error("Encoder not initialized");
      }
      const paddedData = new Uint8Array(data.length + this.degree);
      paddedData.set(data);
      const remainder = Polynomial.mod(paddedData, this.genPoly);
      const start = this.degree - remainder.length;
      if (start > 0) {
        const buff = new Uint8Array(this.degree);
        buff.set(remainder, start);
        return buff;
      }
      return remainder;
    };
    module2.exports = ReedSolomonEncoder;
  }
});

// node_modules/qrcode/lib/core/version-check.js
var require_version_check = __commonJS({
  "node_modules/qrcode/lib/core/version-check.js"(exports2) {
    exports2.isValid = function isValid(version) {
      return !isNaN(version) && version >= 1 && version <= 40;
    };
  }
});

// node_modules/qrcode/lib/core/regex.js
var require_regex = __commonJS({
  "node_modules/qrcode/lib/core/regex.js"(exports2) {
    var numeric = "[0-9]+";
    var alphanumeric = "[A-Z $%*+\\-./:]+";
    var kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
    kanji = kanji.replace(/u/g, "\\u");
    var byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
    exports2.KANJI = new RegExp(kanji, "g");
    exports2.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
    exports2.BYTE = new RegExp(byte, "g");
    exports2.NUMERIC = new RegExp(numeric, "g");
    exports2.ALPHANUMERIC = new RegExp(alphanumeric, "g");
    var TEST_KANJI = new RegExp("^" + kanji + "$");
    var TEST_NUMERIC = new RegExp("^" + numeric + "$");
    var TEST_ALPHANUMERIC = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
    exports2.testKanji = function testKanji(str) {
      return TEST_KANJI.test(str);
    };
    exports2.testNumeric = function testNumeric(str) {
      return TEST_NUMERIC.test(str);
    };
    exports2.testAlphanumeric = function testAlphanumeric(str) {
      return TEST_ALPHANUMERIC.test(str);
    };
  }
});

// node_modules/qrcode/lib/core/mode.js
var require_mode = __commonJS({
  "node_modules/qrcode/lib/core/mode.js"(exports2) {
    var VersionCheck = require_version_check();
    var Regex = require_regex();
    exports2.NUMERIC = {
      id: "Numeric",
      bit: 1 << 0,
      ccBits: [10, 12, 14]
    };
    exports2.ALPHANUMERIC = {
      id: "Alphanumeric",
      bit: 1 << 1,
      ccBits: [9, 11, 13]
    };
    exports2.BYTE = {
      id: "Byte",
      bit: 1 << 2,
      ccBits: [8, 16, 16]
    };
    exports2.KANJI = {
      id: "Kanji",
      bit: 1 << 3,
      ccBits: [8, 10, 12]
    };
    exports2.MIXED = {
      bit: -1
    };
    exports2.getCharCountIndicator = function getCharCountIndicator(mode, version) {
      if (!mode.ccBits) throw new Error("Invalid mode: " + mode);
      if (!VersionCheck.isValid(version)) {
        throw new Error("Invalid version: " + version);
      }
      if (version >= 1 && version < 10) return mode.ccBits[0];
      else if (version < 27) return mode.ccBits[1];
      return mode.ccBits[2];
    };
    exports2.getBestModeForData = function getBestModeForData(dataStr) {
      if (Regex.testNumeric(dataStr)) return exports2.NUMERIC;
      else if (Regex.testAlphanumeric(dataStr)) return exports2.ALPHANUMERIC;
      else if (Regex.testKanji(dataStr)) return exports2.KANJI;
      else return exports2.BYTE;
    };
    exports2.toString = function toString(mode) {
      if (mode && mode.id) return mode.id;
      throw new Error("Invalid mode");
    };
    exports2.isValid = function isValid(mode) {
      return mode && mode.bit && mode.ccBits;
    };
    function fromString(string) {
      if (typeof string !== "string") {
        throw new Error("Param is not a string");
      }
      const lcStr = string.toLowerCase();
      switch (lcStr) {
        case "numeric":
          return exports2.NUMERIC;
        case "alphanumeric":
          return exports2.ALPHANUMERIC;
        case "kanji":
          return exports2.KANJI;
        case "byte":
          return exports2.BYTE;
        default:
          throw new Error("Unknown mode: " + string);
      }
    }
    exports2.from = function from(value, defaultValue) {
      if (exports2.isValid(value)) {
        return value;
      }
      try {
        return fromString(value);
      } catch (e) {
        return defaultValue;
      }
    };
  }
});

// node_modules/qrcode/lib/core/version.js
var require_version = __commonJS({
  "node_modules/qrcode/lib/core/version.js"(exports2) {
    var Utils = require_utils();
    var ECCode = require_error_correction_code();
    var ECLevel = require_error_correction_level();
    var Mode = require_mode();
    var VersionCheck = require_version_check();
    var G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
    var G18_BCH = Utils.getBCHDigit(G18);
    function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
      for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
        if (length <= exports2.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
          return currentVersion;
        }
      }
      return void 0;
    }
    function getReservedBitsCount(mode, version) {
      return Mode.getCharCountIndicator(mode, version) + 4;
    }
    function getTotalBitsFromDataArray(segments, version) {
      let totalBits = 0;
      segments.forEach(function(data) {
        const reservedBits = getReservedBitsCount(data.mode, version);
        totalBits += reservedBits + data.getBitsLength();
      });
      return totalBits;
    }
    function getBestVersionForMixedData(segments, errorCorrectionLevel) {
      for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
        const length = getTotalBitsFromDataArray(segments, currentVersion);
        if (length <= exports2.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
          return currentVersion;
        }
      }
      return void 0;
    }
    exports2.from = function from(value, defaultValue) {
      if (VersionCheck.isValid(value)) {
        return parseInt(value, 10);
      }
      return defaultValue;
    };
    exports2.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
      if (!VersionCheck.isValid(version)) {
        throw new Error("Invalid QR Code version");
      }
      if (typeof mode === "undefined") mode = Mode.BYTE;
      const totalCodewords = Utils.getSymbolTotalCodewords(version);
      const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
      const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
      if (mode === Mode.MIXED) return dataTotalCodewordsBits;
      const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
      switch (mode) {
        case Mode.NUMERIC:
          return Math.floor(usableBits / 10 * 3);
        case Mode.ALPHANUMERIC:
          return Math.floor(usableBits / 11 * 2);
        case Mode.KANJI:
          return Math.floor(usableBits / 13);
        case Mode.BYTE:
        default:
          return Math.floor(usableBits / 8);
      }
    };
    exports2.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
      let seg;
      const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
      if (Array.isArray(data)) {
        if (data.length > 1) {
          return getBestVersionForMixedData(data, ecl);
        }
        if (data.length === 0) {
          return 1;
        }
        seg = data[0];
      } else {
        seg = data;
      }
      return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
    };
    exports2.getEncodedBits = function getEncodedBits(version) {
      if (!VersionCheck.isValid(version) || version < 7) {
        throw new Error("Invalid QR Code version");
      }
      let d = version << 12;
      while (Utils.getBCHDigit(d) - G18_BCH >= 0) {
        d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
      }
      return version << 12 | d;
    };
  }
});

// node_modules/qrcode/lib/core/format-info.js
var require_format_info = __commonJS({
  "node_modules/qrcode/lib/core/format-info.js"(exports2) {
    var Utils = require_utils();
    var G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
    var G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
    var G15_BCH = Utils.getBCHDigit(G15);
    exports2.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
      const data = errorCorrectionLevel.bit << 3 | mask;
      let d = data << 10;
      while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
        d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
      }
      return (data << 10 | d) ^ G15_MASK;
    };
  }
});

// node_modules/qrcode/lib/core/numeric-data.js
var require_numeric_data = __commonJS({
  "node_modules/qrcode/lib/core/numeric-data.js"(exports2, module2) {
    var Mode = require_mode();
    function NumericData(data) {
      this.mode = Mode.NUMERIC;
      this.data = data.toString();
    }
    NumericData.getBitsLength = function getBitsLength(length) {
      return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
    };
    NumericData.prototype.getLength = function getLength() {
      return this.data.length;
    };
    NumericData.prototype.getBitsLength = function getBitsLength() {
      return NumericData.getBitsLength(this.data.length);
    };
    NumericData.prototype.write = function write(bitBuffer) {
      let i, group, value;
      for (i = 0; i + 3 <= this.data.length; i += 3) {
        group = this.data.substr(i, 3);
        value = parseInt(group, 10);
        bitBuffer.put(value, 10);
      }
      const remainingNum = this.data.length - i;
      if (remainingNum > 0) {
        group = this.data.substr(i);
        value = parseInt(group, 10);
        bitBuffer.put(value, remainingNum * 3 + 1);
      }
    };
    module2.exports = NumericData;
  }
});

// node_modules/qrcode/lib/core/alphanumeric-data.js
var require_alphanumeric_data = __commonJS({
  "node_modules/qrcode/lib/core/alphanumeric-data.js"(exports2, module2) {
    var Mode = require_mode();
    var ALPHA_NUM_CHARS = [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
      " ",
      "$",
      "%",
      "*",
      "+",
      "-",
      ".",
      "/",
      ":"
    ];
    function AlphanumericData(data) {
      this.mode = Mode.ALPHANUMERIC;
      this.data = data;
    }
    AlphanumericData.getBitsLength = function getBitsLength(length) {
      return 11 * Math.floor(length / 2) + 6 * (length % 2);
    };
    AlphanumericData.prototype.getLength = function getLength() {
      return this.data.length;
    };
    AlphanumericData.prototype.getBitsLength = function getBitsLength() {
      return AlphanumericData.getBitsLength(this.data.length);
    };
    AlphanumericData.prototype.write = function write(bitBuffer) {
      let i;
      for (i = 0; i + 2 <= this.data.length; i += 2) {
        let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
        value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
        bitBuffer.put(value, 11);
      }
      if (this.data.length % 2) {
        bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
      }
    };
    module2.exports = AlphanumericData;
  }
});

// node_modules/qrcode/lib/core/byte-data.js
var require_byte_data = __commonJS({
  "node_modules/qrcode/lib/core/byte-data.js"(exports2, module2) {
    var Mode = require_mode();
    function ByteData(data) {
      this.mode = Mode.BYTE;
      if (typeof data === "string") {
        this.data = new TextEncoder().encode(data);
      } else {
        this.data = new Uint8Array(data);
      }
    }
    ByteData.getBitsLength = function getBitsLength(length) {
      return length * 8;
    };
    ByteData.prototype.getLength = function getLength() {
      return this.data.length;
    };
    ByteData.prototype.getBitsLength = function getBitsLength() {
      return ByteData.getBitsLength(this.data.length);
    };
    ByteData.prototype.write = function(bitBuffer) {
      for (let i = 0, l = this.data.length; i < l; i++) {
        bitBuffer.put(this.data[i], 8);
      }
    };
    module2.exports = ByteData;
  }
});

// node_modules/qrcode/lib/core/kanji-data.js
var require_kanji_data = __commonJS({
  "node_modules/qrcode/lib/core/kanji-data.js"(exports2, module2) {
    var Mode = require_mode();
    var Utils = require_utils();
    function KanjiData(data) {
      this.mode = Mode.KANJI;
      this.data = data;
    }
    KanjiData.getBitsLength = function getBitsLength(length) {
      return length * 13;
    };
    KanjiData.prototype.getLength = function getLength() {
      return this.data.length;
    };
    KanjiData.prototype.getBitsLength = function getBitsLength() {
      return KanjiData.getBitsLength(this.data.length);
    };
    KanjiData.prototype.write = function(bitBuffer) {
      let i;
      for (i = 0; i < this.data.length; i++) {
        let value = Utils.toSJIS(this.data[i]);
        if (value >= 33088 && value <= 40956) {
          value -= 33088;
        } else if (value >= 57408 && value <= 60351) {
          value -= 49472;
        } else {
          throw new Error(
            "Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8"
          );
        }
        value = (value >>> 8 & 255) * 192 + (value & 255);
        bitBuffer.put(value, 13);
      }
    };
    module2.exports = KanjiData;
  }
});

// node_modules/dijkstrajs/dijkstra.js
var require_dijkstra = __commonJS({
  "node_modules/dijkstrajs/dijkstra.js"(exports2, module2) {
    "use strict";
    var dijkstra = {
      single_source_shortest_paths: function(graph, s, d) {
        var predecessors = {};
        var costs = {};
        costs[s] = 0;
        var open3 = dijkstra.PriorityQueue.make();
        open3.push(s, 0);
        var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
        while (!open3.empty()) {
          closest = open3.pop();
          u = closest.value;
          cost_of_s_to_u = closest.cost;
          adjacent_nodes = graph[u] || {};
          for (v in adjacent_nodes) {
            if (adjacent_nodes.hasOwnProperty(v)) {
              cost_of_e = adjacent_nodes[v];
              cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
              cost_of_s_to_v = costs[v];
              first_visit = typeof costs[v] === "undefined";
              if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
                costs[v] = cost_of_s_to_u_plus_cost_of_e;
                open3.push(v, cost_of_s_to_u_plus_cost_of_e);
                predecessors[v] = u;
              }
            }
          }
        }
        if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
          var msg = ["Could not find a path from ", s, " to ", d, "."].join("");
          throw new Error(msg);
        }
        return predecessors;
      },
      extract_shortest_path_from_predecessor_list: function(predecessors, d) {
        var nodes = [];
        var u = d;
        var predecessor;
        while (u) {
          nodes.push(u);
          predecessor = predecessors[u];
          u = predecessors[u];
        }
        nodes.reverse();
        return nodes;
      },
      find_path: function(graph, s, d) {
        var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
        return dijkstra.extract_shortest_path_from_predecessor_list(
          predecessors,
          d
        );
      },
      /**
       * A very naive priority queue implementation.
       */
      PriorityQueue: {
        make: function(opts) {
          var T = dijkstra.PriorityQueue, t = {}, key;
          opts = opts || {};
          for (key in T) {
            if (T.hasOwnProperty(key)) {
              t[key] = T[key];
            }
          }
          t.queue = [];
          t.sorter = opts.sorter || T.default_sorter;
          return t;
        },
        default_sorter: function(a, b) {
          return a.cost - b.cost;
        },
        /**
         * Add a new item to the queue and ensure the highest priority element
         * is at the front of the queue.
         */
        push: function(value, cost) {
          var item = { value, cost };
          this.queue.push(item);
          this.queue.sort(this.sorter);
        },
        /**
         * Return the highest priority element in the queue.
         */
        pop: function() {
          return this.queue.shift();
        },
        empty: function() {
          return this.queue.length === 0;
        }
      }
    };
    if (typeof module2 !== "undefined") {
      module2.exports = dijkstra;
    }
  }
});

// node_modules/qrcode/lib/core/segments.js
var require_segments = __commonJS({
  "node_modules/qrcode/lib/core/segments.js"(exports2) {
    var Mode = require_mode();
    var NumericData = require_numeric_data();
    var AlphanumericData = require_alphanumeric_data();
    var ByteData = require_byte_data();
    var KanjiData = require_kanji_data();
    var Regex = require_regex();
    var Utils = require_utils();
    var dijkstra = require_dijkstra();
    function getStringByteLength(str) {
      return unescape(encodeURIComponent(str)).length;
    }
    function getSegments(regex, mode, str) {
      const segments = [];
      let result;
      while ((result = regex.exec(str)) !== null) {
        segments.push({
          data: result[0],
          index: result.index,
          mode,
          length: result[0].length
        });
      }
      return segments;
    }
    function getSegmentsFromString(dataStr) {
      const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
      const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
      let byteSegs;
      let kanjiSegs;
      if (Utils.isKanjiModeEnabled()) {
        byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
        kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
      } else {
        byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
        kanjiSegs = [];
      }
      const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);
      return segs.sort(function(s1, s2) {
        return s1.index - s2.index;
      }).map(function(obj) {
        return {
          data: obj.data,
          mode: obj.mode,
          length: obj.length
        };
      });
    }
    function getSegmentBitsLength(length, mode) {
      switch (mode) {
        case Mode.NUMERIC:
          return NumericData.getBitsLength(length);
        case Mode.ALPHANUMERIC:
          return AlphanumericData.getBitsLength(length);
        case Mode.KANJI:
          return KanjiData.getBitsLength(length);
        case Mode.BYTE:
          return ByteData.getBitsLength(length);
      }
    }
    function mergeSegments(segs) {
      return segs.reduce(function(acc, curr) {
        const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
        if (prevSeg && prevSeg.mode === curr.mode) {
          acc[acc.length - 1].data += curr.data;
          return acc;
        }
        acc.push(curr);
        return acc;
      }, []);
    }
    function buildNodes(segs) {
      const nodes = [];
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        switch (seg.mode) {
          case Mode.NUMERIC:
            nodes.push([
              seg,
              { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
              { data: seg.data, mode: Mode.BYTE, length: seg.length }
            ]);
            break;
          case Mode.ALPHANUMERIC:
            nodes.push([
              seg,
              { data: seg.data, mode: Mode.BYTE, length: seg.length }
            ]);
            break;
          case Mode.KANJI:
            nodes.push([
              seg,
              { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
            ]);
            break;
          case Mode.BYTE:
            nodes.push([
              { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
            ]);
        }
      }
      return nodes;
    }
    function buildGraph(nodes, version) {
      const table = {};
      const graph = { start: {} };
      let prevNodeIds = ["start"];
      for (let i = 0; i < nodes.length; i++) {
        const nodeGroup = nodes[i];
        const currentNodeIds = [];
        for (let j = 0; j < nodeGroup.length; j++) {
          const node = nodeGroup[j];
          const key = "" + i + j;
          currentNodeIds.push(key);
          table[key] = { node, lastCount: 0 };
          graph[key] = {};
          for (let n = 0; n < prevNodeIds.length; n++) {
            const prevNodeId = prevNodeIds[n];
            if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
              graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
              table[prevNodeId].lastCount += node.length;
            } else {
              if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;
              graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
            }
          }
        }
        prevNodeIds = currentNodeIds;
      }
      for (let n = 0; n < prevNodeIds.length; n++) {
        graph[prevNodeIds[n]].end = 0;
      }
      return { map: graph, table };
    }
    function buildSingleSegment(data, modesHint) {
      let mode;
      const bestMode = Mode.getBestModeForData(data);
      mode = Mode.from(modesHint, bestMode);
      if (mode !== Mode.BYTE && mode.bit < bestMode.bit) {
        throw new Error('"' + data + '" cannot be encoded with mode ' + Mode.toString(mode) + ".\n Suggested mode is: " + Mode.toString(bestMode));
      }
      if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) {
        mode = Mode.BYTE;
      }
      switch (mode) {
        case Mode.NUMERIC:
          return new NumericData(data);
        case Mode.ALPHANUMERIC:
          return new AlphanumericData(data);
        case Mode.KANJI:
          return new KanjiData(data);
        case Mode.BYTE:
          return new ByteData(data);
      }
    }
    exports2.fromArray = function fromArray(array) {
      return array.reduce(function(acc, seg) {
        if (typeof seg === "string") {
          acc.push(buildSingleSegment(seg, null));
        } else if (seg.data) {
          acc.push(buildSingleSegment(seg.data, seg.mode));
        }
        return acc;
      }, []);
    };
    exports2.fromString = function fromString(data, version) {
      const segs = getSegmentsFromString(data, Utils.isKanjiModeEnabled());
      const nodes = buildNodes(segs);
      const graph = buildGraph(nodes, version);
      const path = dijkstra.find_path(graph.map, "start", "end");
      const optimizedSegs = [];
      for (let i = 1; i < path.length - 1; i++) {
        optimizedSegs.push(graph.table[path[i]].node);
      }
      return exports2.fromArray(mergeSegments(optimizedSegs));
    };
    exports2.rawSplit = function rawSplit(data) {
      return exports2.fromArray(
        getSegmentsFromString(data, Utils.isKanjiModeEnabled())
      );
    };
  }
});

// node_modules/qrcode/lib/core/qrcode.js
var require_qrcode = __commonJS({
  "node_modules/qrcode/lib/core/qrcode.js"(exports2) {
    var Utils = require_utils();
    var ECLevel = require_error_correction_level();
    var BitBuffer = require_bit_buffer();
    var BitMatrix = require_bit_matrix();
    var AlignmentPattern = require_alignment_pattern();
    var FinderPattern = require_finder_pattern();
    var MaskPattern = require_mask_pattern();
    var ECCode = require_error_correction_code();
    var ReedSolomonEncoder = require_reed_solomon_encoder();
    var Version = require_version();
    var FormatInfo = require_format_info();
    var Mode = require_mode();
    var Segments = require_segments();
    function setupFinderPattern(matrix, version) {
      const size = matrix.size;
      const pos = FinderPattern.getPositions(version);
      for (let i = 0; i < pos.length; i++) {
        const row = pos[i][0];
        const col = pos[i][1];
        for (let r = -1; r <= 7; r++) {
          if (row + r <= -1 || size <= row + r) continue;
          for (let c = -1; c <= 7; c++) {
            if (col + c <= -1 || size <= col + c) continue;
            if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) {
              matrix.set(row + r, col + c, true, true);
            } else {
              matrix.set(row + r, col + c, false, true);
            }
          }
        }
      }
    }
    function setupTimingPattern(matrix) {
      const size = matrix.size;
      for (let r = 8; r < size - 8; r++) {
        const value = r % 2 === 0;
        matrix.set(r, 6, value, true);
        matrix.set(6, r, value, true);
      }
    }
    function setupAlignmentPattern(matrix, version) {
      const pos = AlignmentPattern.getPositions(version);
      for (let i = 0; i < pos.length; i++) {
        const row = pos[i][0];
        const col = pos[i][1];
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) {
              matrix.set(row + r, col + c, true, true);
            } else {
              matrix.set(row + r, col + c, false, true);
            }
          }
        }
      }
    }
    function setupVersionInfo(matrix, version) {
      const size = matrix.size;
      const bits = Version.getEncodedBits(version);
      let row, col, mod;
      for (let i = 0; i < 18; i++) {
        row = Math.floor(i / 3);
        col = i % 3 + size - 8 - 3;
        mod = (bits >> i & 1) === 1;
        matrix.set(row, col, mod, true);
        matrix.set(col, row, mod, true);
      }
    }
    function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
      const size = matrix.size;
      const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
      let i, mod;
      for (i = 0; i < 15; i++) {
        mod = (bits >> i & 1) === 1;
        if (i < 6) {
          matrix.set(i, 8, mod, true);
        } else if (i < 8) {
          matrix.set(i + 1, 8, mod, true);
        } else {
          matrix.set(size - 15 + i, 8, mod, true);
        }
        if (i < 8) {
          matrix.set(8, size - i - 1, mod, true);
        } else if (i < 9) {
          matrix.set(8, 15 - i - 1 + 1, mod, true);
        } else {
          matrix.set(8, 15 - i - 1, mod, true);
        }
      }
      matrix.set(size - 8, 8, 1, true);
    }
    function setupData(matrix, data) {
      const size = matrix.size;
      let inc = -1;
      let row = size - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (!matrix.isReserved(row, col - c)) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (data[byteIndex] >>> bitIndex & 1) === 1;
              }
              matrix.set(row, col - c, dark);
              bitIndex--;
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || size <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }
    function createData(version, errorCorrectionLevel, segments) {
      const buffer = new BitBuffer();
      segments.forEach(function(data) {
        buffer.put(data.mode.bit, 4);
        buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
        data.write(buffer);
      });
      const totalCodewords = Utils.getSymbolTotalCodewords(version);
      const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
      const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
      if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
        buffer.put(0, 4);
      }
      while (buffer.getLengthInBits() % 8 !== 0) {
        buffer.putBit(0);
      }
      const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
      for (let i = 0; i < remainingByte; i++) {
        buffer.put(i % 2 ? 17 : 236, 8);
      }
      return createCodewords(buffer, version, errorCorrectionLevel);
    }
    function createCodewords(bitBuffer, version, errorCorrectionLevel) {
      const totalCodewords = Utils.getSymbolTotalCodewords(version);
      const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
      const dataTotalCodewords = totalCodewords - ecTotalCodewords;
      const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
      const blocksInGroup2 = totalCodewords % ecTotalBlocks;
      const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;
      const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
      const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
      const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
      const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
      const rs = new ReedSolomonEncoder(ecCount);
      let offset = 0;
      const dcData = new Array(ecTotalBlocks);
      const ecData = new Array(ecTotalBlocks);
      let maxDataSize = 0;
      const buffer = new Uint8Array(bitBuffer.buffer);
      for (let b = 0; b < ecTotalBlocks; b++) {
        const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
        dcData[b] = buffer.slice(offset, offset + dataSize);
        ecData[b] = rs.encode(dcData[b]);
        offset += dataSize;
        maxDataSize = Math.max(maxDataSize, dataSize);
      }
      const data = new Uint8Array(totalCodewords);
      let index = 0;
      let i, r;
      for (i = 0; i < maxDataSize; i++) {
        for (r = 0; r < ecTotalBlocks; r++) {
          if (i < dcData[r].length) {
            data[index++] = dcData[r][i];
          }
        }
      }
      for (i = 0; i < ecCount; i++) {
        for (r = 0; r < ecTotalBlocks; r++) {
          data[index++] = ecData[r][i];
        }
      }
      return data;
    }
    function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
      let segments;
      if (Array.isArray(data)) {
        segments = Segments.fromArray(data);
      } else if (typeof data === "string") {
        let estimatedVersion = version;
        if (!estimatedVersion) {
          const rawSegments = Segments.rawSplit(data);
          estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
        }
        segments = Segments.fromString(data, estimatedVersion || 40);
      } else {
        throw new Error("Invalid data");
      }
      const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
      if (!bestVersion) {
        throw new Error("The amount of data is too big to be stored in a QR Code");
      }
      if (!version) {
        version = bestVersion;
      } else if (version < bestVersion) {
        throw new Error(
          "\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n"
        );
      }
      const dataBits = createData(version, errorCorrectionLevel, segments);
      const moduleCount = Utils.getSymbolSize(version);
      const modules = new BitMatrix(moduleCount);
      setupFinderPattern(modules, version);
      setupTimingPattern(modules);
      setupAlignmentPattern(modules, version);
      setupFormatInfo(modules, errorCorrectionLevel, 0);
      if (version >= 7) {
        setupVersionInfo(modules, version);
      }
      setupData(modules, dataBits);
      if (isNaN(maskPattern)) {
        maskPattern = MaskPattern.getBestMask(
          modules,
          setupFormatInfo.bind(null, modules, errorCorrectionLevel)
        );
      }
      MaskPattern.applyMask(maskPattern, modules);
      setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
      return {
        modules,
        version,
        errorCorrectionLevel,
        maskPattern,
        segments
      };
    }
    exports2.create = function create(data, options) {
      if (typeof data === "undefined" || data === "") {
        throw new Error("No input text");
      }
      let errorCorrectionLevel = ECLevel.M;
      let version;
      let mask;
      if (typeof options !== "undefined") {
        errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
        version = Version.from(options.version);
        mask = MaskPattern.from(options.maskPattern);
        if (options.toSJISFunc) {
          Utils.setToSJISFunction(options.toSJISFunc);
        }
      }
      return createSymbol(data, version, errorCorrectionLevel, mask);
    };
  }
});

// node_modules/pngjs/lib/chunkstream.js
var require_chunkstream = __commonJS({
  "node_modules/pngjs/lib/chunkstream.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var ChunkStream = module2.exports = function() {
      Stream.call(this);
      this._buffers = [];
      this._buffered = 0;
      this._reads = [];
      this._paused = false;
      this._encoding = "utf8";
      this.writable = true;
    };
    util.inherits(ChunkStream, Stream);
    ChunkStream.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
      process.nextTick(
        function() {
          this._process();
          if (this._paused && this._reads && this._reads.length > 0) {
            this._paused = false;
            this.emit("drain");
          }
        }.bind(this)
      );
    };
    ChunkStream.prototype.write = function(data, encoding) {
      if (!this.writable) {
        this.emit("error", new Error("Stream not writable"));
        return false;
      }
      let dataBuffer;
      if (Buffer.isBuffer(data)) {
        dataBuffer = data;
      } else {
        dataBuffer = Buffer.from(data, encoding || this._encoding);
      }
      this._buffers.push(dataBuffer);
      this._buffered += dataBuffer.length;
      this._process();
      if (this._reads && this._reads.length === 0) {
        this._paused = true;
      }
      return this.writable && !this._paused;
    };
    ChunkStream.prototype.end = function(data, encoding) {
      if (data) {
        this.write(data, encoding);
      }
      this.writable = false;
      if (!this._buffers) {
        return;
      }
      if (this._buffers.length === 0) {
        this._end();
      } else {
        this._buffers.push(null);
        this._process();
      }
    };
    ChunkStream.prototype.destroySoon = ChunkStream.prototype.end;
    ChunkStream.prototype._end = function() {
      if (this._reads.length > 0) {
        this.emit("error", new Error("Unexpected end of input"));
      }
      this.destroy();
    };
    ChunkStream.prototype.destroy = function() {
      if (!this._buffers) {
        return;
      }
      this.writable = false;
      this._reads = null;
      this._buffers = null;
      this.emit("close");
    };
    ChunkStream.prototype._processReadAllowingLess = function(read) {
      this._reads.shift();
      let smallerBuf = this._buffers[0];
      if (smallerBuf.length > read.length) {
        this._buffered -= read.length;
        this._buffers[0] = smallerBuf.slice(read.length);
        read.func.call(this, smallerBuf.slice(0, read.length));
      } else {
        this._buffered -= smallerBuf.length;
        this._buffers.shift();
        read.func.call(this, smallerBuf);
      }
    };
    ChunkStream.prototype._processRead = function(read) {
      this._reads.shift();
      let pos = 0;
      let count = 0;
      let data = Buffer.alloc(read.length);
      while (pos < read.length) {
        let buf = this._buffers[count++];
        let len = Math.min(buf.length, read.length - pos);
        buf.copy(data, pos, 0, len);
        pos += len;
        if (len !== buf.length) {
          this._buffers[--count] = buf.slice(len);
        }
      }
      if (count > 0) {
        this._buffers.splice(0, count);
      }
      this._buffered -= read.length;
      read.func.call(this, data);
    };
    ChunkStream.prototype._process = function() {
      try {
        while (this._buffered > 0 && this._reads && this._reads.length > 0) {
          let read = this._reads[0];
          if (read.allowLess) {
            this._processReadAllowingLess(read);
          } else if (this._buffered >= read.length) {
            this._processRead(read);
          } else {
            break;
          }
        }
        if (this._buffers && !this.writable) {
          this._end();
        }
      } catch (ex) {
        this.emit("error", ex);
      }
    };
  }
});

// node_modules/pngjs/lib/interlace.js
var require_interlace = __commonJS({
  "node_modules/pngjs/lib/interlace.js"(exports2) {
    "use strict";
    var imagePasses = [
      {
        // pass 1 - 1px
        x: [0],
        y: [0]
      },
      {
        // pass 2 - 1px
        x: [4],
        y: [0]
      },
      {
        // pass 3 - 2px
        x: [0, 4],
        y: [4]
      },
      {
        // pass 4 - 4px
        x: [2, 6],
        y: [0, 4]
      },
      {
        // pass 5 - 8px
        x: [0, 2, 4, 6],
        y: [2, 6]
      },
      {
        // pass 6 - 16px
        x: [1, 3, 5, 7],
        y: [0, 2, 4, 6]
      },
      {
        // pass 7 - 32px
        x: [0, 1, 2, 3, 4, 5, 6, 7],
        y: [1, 3, 5, 7]
      }
    ];
    exports2.getImagePasses = function(width, height) {
      let images = [];
      let xLeftOver = width % 8;
      let yLeftOver = height % 8;
      let xRepeats = (width - xLeftOver) / 8;
      let yRepeats = (height - yLeftOver) / 8;
      for (let i = 0; i < imagePasses.length; i++) {
        let pass = imagePasses[i];
        let passWidth = xRepeats * pass.x.length;
        let passHeight = yRepeats * pass.y.length;
        for (let j = 0; j < pass.x.length; j++) {
          if (pass.x[j] < xLeftOver) {
            passWidth++;
          } else {
            break;
          }
        }
        for (let j = 0; j < pass.y.length; j++) {
          if (pass.y[j] < yLeftOver) {
            passHeight++;
          } else {
            break;
          }
        }
        if (passWidth > 0 && passHeight > 0) {
          images.push({ width: passWidth, height: passHeight, index: i });
        }
      }
      return images;
    };
    exports2.getInterlaceIterator = function(width) {
      return function(x, y, pass) {
        let outerXLeftOver = x % imagePasses[pass].x.length;
        let outerX = (x - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
        let outerYLeftOver = y % imagePasses[pass].y.length;
        let outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
        return outerX * 4 + outerY * width * 4;
      };
    };
  }
});

// node_modules/pngjs/lib/paeth-predictor.js
var require_paeth_predictor = __commonJS({
  "node_modules/pngjs/lib/paeth-predictor.js"(exports2, module2) {
    "use strict";
    module2.exports = function paethPredictor(left, above, upLeft) {
      let paeth = left + above - upLeft;
      let pLeft = Math.abs(paeth - left);
      let pAbove = Math.abs(paeth - above);
      let pUpLeft = Math.abs(paeth - upLeft);
      if (pLeft <= pAbove && pLeft <= pUpLeft) {
        return left;
      }
      if (pAbove <= pUpLeft) {
        return above;
      }
      return upLeft;
    };
  }
});

// node_modules/pngjs/lib/filter-parse.js
var require_filter_parse = __commonJS({
  "node_modules/pngjs/lib/filter-parse.js"(exports2, module2) {
    "use strict";
    var interlaceUtils = require_interlace();
    var paethPredictor = require_paeth_predictor();
    function getByteWidth(width, bpp, depth) {
      let byteWidth = width * bpp;
      if (depth !== 8) {
        byteWidth = Math.ceil(byteWidth / (8 / depth));
      }
      return byteWidth;
    }
    var Filter = module2.exports = function(bitmapInfo, dependencies) {
      let width = bitmapInfo.width;
      let height = bitmapInfo.height;
      let interlace = bitmapInfo.interlace;
      let bpp = bitmapInfo.bpp;
      let depth = bitmapInfo.depth;
      this.read = dependencies.read;
      this.write = dependencies.write;
      this.complete = dependencies.complete;
      this._imageIndex = 0;
      this._images = [];
      if (interlace) {
        let passes = interlaceUtils.getImagePasses(width, height);
        for (let i = 0; i < passes.length; i++) {
          this._images.push({
            byteWidth: getByteWidth(passes[i].width, bpp, depth),
            height: passes[i].height,
            lineIndex: 0
          });
        }
      } else {
        this._images.push({
          byteWidth: getByteWidth(width, bpp, depth),
          height,
          lineIndex: 0
        });
      }
      if (depth === 8) {
        this._xComparison = bpp;
      } else if (depth === 16) {
        this._xComparison = bpp * 2;
      } else {
        this._xComparison = 1;
      }
    };
    Filter.prototype.start = function() {
      this.read(
        this._images[this._imageIndex].byteWidth + 1,
        this._reverseFilterLine.bind(this)
      );
    };
    Filter.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        unfilteredLine[x] = rawByte + f1Left;
      }
    };
    Filter.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f2Up = lastLine ? lastLine[x] : 0;
        unfilteredLine[x] = rawByte + f2Up;
      }
    };
    Filter.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f3Up = lastLine ? lastLine[x] : 0;
        let f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        let f3Add = Math.floor((f3Left + f3Up) / 2);
        unfilteredLine[x] = rawByte + f3Add;
      }
    };
    Filter.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
      let xComparison = this._xComparison;
      let xBiggerThan = xComparison - 1;
      let lastLine = this._lastLine;
      for (let x = 0; x < byteWidth; x++) {
        let rawByte = rawData[1 + x];
        let f4Up = lastLine ? lastLine[x] : 0;
        let f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
        let f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
        let f4Add = paethPredictor(f4Left, f4Up, f4UpLeft);
        unfilteredLine[x] = rawByte + f4Add;
      }
    };
    Filter.prototype._reverseFilterLine = function(rawData) {
      let filter = rawData[0];
      let unfilteredLine;
      let currentImage = this._images[this._imageIndex];
      let byteWidth = currentImage.byteWidth;
      if (filter === 0) {
        unfilteredLine = rawData.slice(1, byteWidth + 1);
      } else {
        unfilteredLine = Buffer.alloc(byteWidth);
        switch (filter) {
          case 1:
            this._unFilterType1(rawData, unfilteredLine, byteWidth);
            break;
          case 2:
            this._unFilterType2(rawData, unfilteredLine, byteWidth);
            break;
          case 3:
            this._unFilterType3(rawData, unfilteredLine, byteWidth);
            break;
          case 4:
            this._unFilterType4(rawData, unfilteredLine, byteWidth);
            break;
          default:
            throw new Error("Unrecognised filter type - " + filter);
        }
      }
      this.write(unfilteredLine);
      currentImage.lineIndex++;
      if (currentImage.lineIndex >= currentImage.height) {
        this._lastLine = null;
        this._imageIndex++;
        currentImage = this._images[this._imageIndex];
      } else {
        this._lastLine = unfilteredLine;
      }
      if (currentImage) {
        this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
      } else {
        this._lastLine = null;
        this.complete();
      }
    };
  }
});

// node_modules/pngjs/lib/filter-parse-async.js
var require_filter_parse_async = __commonJS({
  "node_modules/pngjs/lib/filter-parse-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var ChunkStream = require_chunkstream();
    var Filter = require_filter_parse();
    var FilterAsync = module2.exports = function(bitmapInfo) {
      ChunkStream.call(this);
      let buffers = [];
      let that = this;
      this._filter = new Filter(bitmapInfo, {
        read: this.read.bind(this),
        write: function(buffer) {
          buffers.push(buffer);
        },
        complete: function() {
          that.emit("complete", Buffer.concat(buffers));
        }
      });
      this._filter.start();
    };
    util.inherits(FilterAsync, ChunkStream);
  }
});

// node_modules/pngjs/lib/constants.js
var require_constants = __commonJS({
  "node_modules/pngjs/lib/constants.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      PNG_SIGNATURE: [137, 80, 78, 71, 13, 10, 26, 10],
      TYPE_IHDR: 1229472850,
      TYPE_IEND: 1229278788,
      TYPE_IDAT: 1229209940,
      TYPE_PLTE: 1347179589,
      TYPE_tRNS: 1951551059,
      // eslint-disable-line camelcase
      TYPE_gAMA: 1732332865,
      // eslint-disable-line camelcase
      // color-type bits
      COLORTYPE_GRAYSCALE: 0,
      COLORTYPE_PALETTE: 1,
      COLORTYPE_COLOR: 2,
      COLORTYPE_ALPHA: 4,
      // e.g. grayscale and alpha
      // color-type combinations
      COLORTYPE_PALETTE_COLOR: 3,
      COLORTYPE_COLOR_ALPHA: 6,
      COLORTYPE_TO_BPP_MAP: {
        0: 1,
        2: 3,
        3: 1,
        4: 2,
        6: 4
      },
      GAMMA_DIVISION: 1e5
    };
  }
});

// node_modules/pngjs/lib/crc.js
var require_crc = __commonJS({
  "node_modules/pngjs/lib/crc.js"(exports2, module2) {
    "use strict";
    var crcTable = [];
    (function() {
      for (let i = 0; i < 256; i++) {
        let currentCrc = i;
        for (let j = 0; j < 8; j++) {
          if (currentCrc & 1) {
            currentCrc = 3988292384 ^ currentCrc >>> 1;
          } else {
            currentCrc = currentCrc >>> 1;
          }
        }
        crcTable[i] = currentCrc;
      }
    })();
    var CrcCalculator = module2.exports = function() {
      this._crc = -1;
    };
    CrcCalculator.prototype.write = function(data) {
      for (let i = 0; i < data.length; i++) {
        this._crc = crcTable[(this._crc ^ data[i]) & 255] ^ this._crc >>> 8;
      }
      return true;
    };
    CrcCalculator.prototype.crc32 = function() {
      return this._crc ^ -1;
    };
    CrcCalculator.crc32 = function(buf) {
      let crc = -1;
      for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 255] ^ crc >>> 8;
      }
      return crc ^ -1;
    };
  }
});

// node_modules/pngjs/lib/parser.js
var require_parser = __commonJS({
  "node_modules/pngjs/lib/parser.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    var CrcCalculator = require_crc();
    var Parser = module2.exports = function(options, dependencies) {
      this._options = options;
      options.checkCRC = options.checkCRC !== false;
      this._hasIHDR = false;
      this._hasIEND = false;
      this._emittedHeadersFinished = false;
      this._palette = [];
      this._colorType = 0;
      this._chunks = {};
      this._chunks[constants.TYPE_IHDR] = this._handleIHDR.bind(this);
      this._chunks[constants.TYPE_IEND] = this._handleIEND.bind(this);
      this._chunks[constants.TYPE_IDAT] = this._handleIDAT.bind(this);
      this._chunks[constants.TYPE_PLTE] = this._handlePLTE.bind(this);
      this._chunks[constants.TYPE_tRNS] = this._handleTRNS.bind(this);
      this._chunks[constants.TYPE_gAMA] = this._handleGAMA.bind(this);
      this.read = dependencies.read;
      this.error = dependencies.error;
      this.metadata = dependencies.metadata;
      this.gamma = dependencies.gamma;
      this.transColor = dependencies.transColor;
      this.palette = dependencies.palette;
      this.parsed = dependencies.parsed;
      this.inflateData = dependencies.inflateData;
      this.finished = dependencies.finished;
      this.simpleTransparency = dependencies.simpleTransparency;
      this.headersFinished = dependencies.headersFinished || function() {
      };
    };
    Parser.prototype.start = function() {
      this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
    };
    Parser.prototype._parseSignature = function(data) {
      let signature = constants.PNG_SIGNATURE;
      for (let i = 0; i < signature.length; i++) {
        if (data[i] !== signature[i]) {
          this.error(new Error("Invalid file signature"));
          return;
        }
      }
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._parseChunkBegin = function(data) {
      let length = data.readUInt32BE(0);
      let type = data.readUInt32BE(4);
      let name = "";
      for (let i = 4; i < 8; i++) {
        name += String.fromCharCode(data[i]);
      }
      let ancillary = Boolean(data[4] & 32);
      if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
        this.error(new Error("Expected IHDR on beggining"));
        return;
      }
      this._crc = new CrcCalculator();
      this._crc.write(Buffer.from(name));
      if (this._chunks[type]) {
        return this._chunks[type](length);
      }
      if (!ancillary) {
        this.error(new Error("Unsupported critical chunk type " + name));
        return;
      }
      this.read(length + 4, this._skipChunk.bind(this));
    };
    Parser.prototype._skipChunk = function() {
      this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._handleChunkEnd = function() {
      this.read(4, this._parseChunkEnd.bind(this));
    };
    Parser.prototype._parseChunkEnd = function(data) {
      let fileCrc = data.readInt32BE(0);
      let calcCrc = this._crc.crc32();
      if (this._options.checkCRC && calcCrc !== fileCrc) {
        this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
        return;
      }
      if (!this._hasIEND) {
        this.read(8, this._parseChunkBegin.bind(this));
      }
    };
    Parser.prototype._handleIHDR = function(length) {
      this.read(length, this._parseIHDR.bind(this));
    };
    Parser.prototype._parseIHDR = function(data) {
      this._crc.write(data);
      let width = data.readUInt32BE(0);
      let height = data.readUInt32BE(4);
      let depth = data[8];
      let colorType = data[9];
      let compr = data[10];
      let filter = data[11];
      let interlace = data[12];
      if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
        this.error(new Error("Unsupported bit depth " + depth));
        return;
      }
      if (!(colorType in constants.COLORTYPE_TO_BPP_MAP)) {
        this.error(new Error("Unsupported color type"));
        return;
      }
      if (compr !== 0) {
        this.error(new Error("Unsupported compression method"));
        return;
      }
      if (filter !== 0) {
        this.error(new Error("Unsupported filter method"));
        return;
      }
      if (interlace !== 0 && interlace !== 1) {
        this.error(new Error("Unsupported interlace method"));
        return;
      }
      this._colorType = colorType;
      let bpp = constants.COLORTYPE_TO_BPP_MAP[this._colorType];
      this._hasIHDR = true;
      this.metadata({
        width,
        height,
        depth,
        interlace: Boolean(interlace),
        palette: Boolean(colorType & constants.COLORTYPE_PALETTE),
        color: Boolean(colorType & constants.COLORTYPE_COLOR),
        alpha: Boolean(colorType & constants.COLORTYPE_ALPHA),
        bpp,
        colorType
      });
      this._handleChunkEnd();
    };
    Parser.prototype._handlePLTE = function(length) {
      this.read(length, this._parsePLTE.bind(this));
    };
    Parser.prototype._parsePLTE = function(data) {
      this._crc.write(data);
      let entries = Math.floor(data.length / 3);
      for (let i = 0; i < entries; i++) {
        this._palette.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 255]);
      }
      this.palette(this._palette);
      this._handleChunkEnd();
    };
    Parser.prototype._handleTRNS = function(length) {
      this.simpleTransparency();
      this.read(length, this._parseTRNS.bind(this));
    };
    Parser.prototype._parseTRNS = function(data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR) {
        if (this._palette.length === 0) {
          this.error(new Error("Transparency chunk must be after palette"));
          return;
        }
        if (data.length > this._palette.length) {
          this.error(new Error("More transparent colors than palette size"));
          return;
        }
        for (let i = 0; i < data.length; i++) {
          this._palette[i][3] = data[i];
        }
        this.palette(this._palette);
      }
      if (this._colorType === constants.COLORTYPE_GRAYSCALE) {
        this.transColor([data.readUInt16BE(0)]);
      }
      if (this._colorType === constants.COLORTYPE_COLOR) {
        this.transColor([
          data.readUInt16BE(0),
          data.readUInt16BE(2),
          data.readUInt16BE(4)
        ]);
      }
      this._handleChunkEnd();
    };
    Parser.prototype._handleGAMA = function(length) {
      this.read(length, this._parseGAMA.bind(this));
    };
    Parser.prototype._parseGAMA = function(data) {
      this._crc.write(data);
      this.gamma(data.readUInt32BE(0) / constants.GAMMA_DIVISION);
      this._handleChunkEnd();
    };
    Parser.prototype._handleIDAT = function(length) {
      if (!this._emittedHeadersFinished) {
        this._emittedHeadersFinished = true;
        this.headersFinished();
      }
      this.read(-length, this._parseIDAT.bind(this, length));
    };
    Parser.prototype._parseIDAT = function(length, data) {
      this._crc.write(data);
      if (this._colorType === constants.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) {
        throw new Error("Expected palette not found");
      }
      this.inflateData(data);
      let leftOverLength = length - data.length;
      if (leftOverLength > 0) {
        this._handleIDAT(leftOverLength);
      } else {
        this._handleChunkEnd();
      }
    };
    Parser.prototype._handleIEND = function(length) {
      this.read(length, this._parseIEND.bind(this));
    };
    Parser.prototype._parseIEND = function(data) {
      this._crc.write(data);
      this._hasIEND = true;
      this._handleChunkEnd();
      if (this.finished) {
        this.finished();
      }
    };
  }
});

// node_modules/pngjs/lib/bitmapper.js
var require_bitmapper = __commonJS({
  "node_modules/pngjs/lib/bitmapper.js"(exports2) {
    "use strict";
    var interlaceUtils = require_interlace();
    var pixelBppMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos === data.length) {
          throw new Error("Ran out of data");
        }
        let pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = 255;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 1 >= data.length) {
          throw new Error("Ran out of data");
        }
        let pixel = data[rawPos];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = data[rawPos + 1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 2 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = 255;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, data, pxPos, rawPos) {
        if (rawPos + 3 >= data.length) {
          throw new Error("Ran out of data");
        }
        pxData[pxPos] = data[rawPos];
        pxData[pxPos + 1] = data[rawPos + 1];
        pxData[pxPos + 2] = data[rawPos + 2];
        pxData[pxPos + 3] = data[rawPos + 3];
      }
    ];
    var pixelBppCustomMapper = [
      // 0 - dummy entry
      function() {
      },
      // 1 - L
      // 0: 0, 1: 0, 2: 0, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        let pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = maxBit;
      },
      // 2 - LA
      // 0: 0, 1: 0, 2: 0, 3: 1
      function(pxData, pixelData, pxPos) {
        let pixel = pixelData[0];
        pxData[pxPos] = pixel;
        pxData[pxPos + 1] = pixel;
        pxData[pxPos + 2] = pixel;
        pxData[pxPos + 3] = pixelData[1];
      },
      // 3 - RGB
      // 0: 0, 1: 1, 2: 2, 3: 0xff
      function(pxData, pixelData, pxPos, maxBit) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = maxBit;
      },
      // 4 - RGBA
      // 0: 0, 1: 1, 2: 2, 3: 3
      function(pxData, pixelData, pxPos) {
        pxData[pxPos] = pixelData[0];
        pxData[pxPos + 1] = pixelData[1];
        pxData[pxPos + 2] = pixelData[2];
        pxData[pxPos + 3] = pixelData[3];
      }
    ];
    function bitRetriever(data, depth) {
      let leftOver = [];
      let i = 0;
      function split() {
        if (i === data.length) {
          throw new Error("Ran out of data");
        }
        let byte = data[i];
        i++;
        let byte8, byte7, byte6, byte5, byte4, byte3, byte2, byte1;
        switch (depth) {
          default:
            throw new Error("unrecognised depth");
          case 16:
            byte2 = data[i];
            i++;
            leftOver.push((byte << 8) + byte2);
            break;
          case 4:
            byte2 = byte & 15;
            byte1 = byte >> 4;
            leftOver.push(byte1, byte2);
            break;
          case 2:
            byte4 = byte & 3;
            byte3 = byte >> 2 & 3;
            byte2 = byte >> 4 & 3;
            byte1 = byte >> 6 & 3;
            leftOver.push(byte1, byte2, byte3, byte4);
            break;
          case 1:
            byte8 = byte & 1;
            byte7 = byte >> 1 & 1;
            byte6 = byte >> 2 & 1;
            byte5 = byte >> 3 & 1;
            byte4 = byte >> 4 & 1;
            byte3 = byte >> 5 & 1;
            byte2 = byte >> 6 & 1;
            byte1 = byte >> 7 & 1;
            leftOver.push(byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8);
            break;
        }
      }
      return {
        get: function(count) {
          while (leftOver.length < count) {
            split();
          }
          let returner = leftOver.slice(0, count);
          leftOver = leftOver.slice(count);
          return returner;
        },
        resetAfterLine: function() {
          leftOver.length = 0;
        },
        end: function() {
          if (i !== data.length) {
            throw new Error("extra data found");
          }
        }
      };
    }
    function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) {
      let imageWidth = image.width;
      let imageHeight = image.height;
      let imagePass = image.index;
      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          let pxPos = getPxPos(x, y, imagePass);
          pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
          rawPos += bpp;
        }
      }
      return rawPos;
    }
    function mapImageCustomBit(image, pxData, getPxPos, bpp, bits, maxBit) {
      let imageWidth = image.width;
      let imageHeight = image.height;
      let imagePass = image.index;
      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          let pixelData = bits.get(bpp);
          let pxPos = getPxPos(x, y, imagePass);
          pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
        }
        bits.resetAfterLine();
      }
    }
    exports2.dataToBitMap = function(data, bitmapInfo) {
      let width = bitmapInfo.width;
      let height = bitmapInfo.height;
      let depth = bitmapInfo.depth;
      let bpp = bitmapInfo.bpp;
      let interlace = bitmapInfo.interlace;
      let bits;
      if (depth !== 8) {
        bits = bitRetriever(data, depth);
      }
      let pxData;
      if (depth <= 8) {
        pxData = Buffer.alloc(width * height * 4);
      } else {
        pxData = new Uint16Array(width * height * 4);
      }
      let maxBit = Math.pow(2, depth) - 1;
      let rawPos = 0;
      let images;
      let getPxPos;
      if (interlace) {
        images = interlaceUtils.getImagePasses(width, height);
        getPxPos = interlaceUtils.getInterlaceIterator(width, height);
      } else {
        let nonInterlacedPxPos = 0;
        getPxPos = function() {
          let returner = nonInterlacedPxPos;
          nonInterlacedPxPos += 4;
          return returner;
        };
        images = [{ width, height }];
      }
      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        if (depth === 8) {
          rawPos = mapImage8Bit(
            images[imageIndex],
            pxData,
            getPxPos,
            bpp,
            data,
            rawPos
          );
        } else {
          mapImageCustomBit(
            images[imageIndex],
            pxData,
            getPxPos,
            bpp,
            bits,
            maxBit
          );
        }
      }
      if (depth === 8) {
        if (rawPos !== data.length) {
          throw new Error("extra data found");
        }
      } else {
        bits.end();
      }
      return pxData;
    };
  }
});

// node_modules/pngjs/lib/format-normaliser.js
var require_format_normaliser = __commonJS({
  "node_modules/pngjs/lib/format-normaliser.js"(exports2, module2) {
    "use strict";
    function dePalette(indata, outdata, width, height, palette) {
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let color = palette[indata[pxPos]];
          if (!color) {
            throw new Error("index " + indata[pxPos] + " not in palette");
          }
          for (let i = 0; i < 4; i++) {
            outdata[pxPos + i] = color[i];
          }
          pxPos += 4;
        }
      }
    }
    function replaceTransparentColor(indata, outdata, width, height, transColor) {
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let makeTrans = false;
          if (transColor.length === 1) {
            if (transColor[0] === indata[pxPos]) {
              makeTrans = true;
            }
          } else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) {
            makeTrans = true;
          }
          if (makeTrans) {
            for (let i = 0; i < 4; i++) {
              outdata[pxPos + i] = 0;
            }
          }
          pxPos += 4;
        }
      }
    }
    function scaleDepth(indata, outdata, width, height, depth) {
      let maxOutSample = 255;
      let maxInSample = Math.pow(2, depth) - 1;
      let pxPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          for (let i = 0; i < 4; i++) {
            outdata[pxPos + i] = Math.floor(
              indata[pxPos + i] * maxOutSample / maxInSample + 0.5
            );
          }
          pxPos += 4;
        }
      }
    }
    module2.exports = function(indata, imageData) {
      let depth = imageData.depth;
      let width = imageData.width;
      let height = imageData.height;
      let colorType = imageData.colorType;
      let transColor = imageData.transColor;
      let palette = imageData.palette;
      let outdata = indata;
      if (colorType === 3) {
        dePalette(indata, outdata, width, height, palette);
      } else {
        if (transColor) {
          replaceTransparentColor(indata, outdata, width, height, transColor);
        }
        if (depth !== 8) {
          if (depth === 16) {
            outdata = Buffer.alloc(width * height * 4);
          }
          scaleDepth(indata, outdata, width, height, depth);
        }
      }
      return outdata;
    };
  }
});

// node_modules/pngjs/lib/parser-async.js
var require_parser_async = __commonJS({
  "node_modules/pngjs/lib/parser-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var zlib = require("zlib");
    var ChunkStream = require_chunkstream();
    var FilterAsync = require_filter_parse_async();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    var ParserAsync = module2.exports = function(options) {
      ChunkStream.call(this);
      this._parser = new Parser(options, {
        read: this.read.bind(this),
        error: this._handleError.bind(this),
        metadata: this._handleMetaData.bind(this),
        gamma: this.emit.bind(this, "gamma"),
        palette: this._handlePalette.bind(this),
        transColor: this._handleTransColor.bind(this),
        finished: this._finished.bind(this),
        inflateData: this._inflateData.bind(this),
        simpleTransparency: this._simpleTransparency.bind(this),
        headersFinished: this._headersFinished.bind(this)
      });
      this._options = options;
      this.writable = true;
      this._parser.start();
    };
    util.inherits(ParserAsync, ChunkStream);
    ParserAsync.prototype._handleError = function(err) {
      this.emit("error", err);
      this.writable = false;
      this.destroy();
      if (this._inflate && this._inflate.destroy) {
        this._inflate.destroy();
      }
      if (this._filter) {
        this._filter.destroy();
        this._filter.on("error", function() {
        });
      }
      this.errord = true;
    };
    ParserAsync.prototype._inflateData = function(data) {
      if (!this._inflate) {
        if (this._bitmapInfo.interlace) {
          this._inflate = zlib.createInflate();
          this._inflate.on("error", this.emit.bind(this, "error"));
          this._filter.on("complete", this._complete.bind(this));
          this._inflate.pipe(this._filter);
        } else {
          let rowSize = (this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1;
          let imageSize = rowSize * this._bitmapInfo.height;
          let chunkSize = Math.max(imageSize, zlib.Z_MIN_CHUNK);
          this._inflate = zlib.createInflate({ chunkSize });
          let leftToInflate = imageSize;
          let emitError = this.emit.bind(this, "error");
          this._inflate.on("error", function(err) {
            if (!leftToInflate) {
              return;
            }
            emitError(err);
          });
          this._filter.on("complete", this._complete.bind(this));
          let filterWrite = this._filter.write.bind(this._filter);
          this._inflate.on("data", function(chunk) {
            if (!leftToInflate) {
              return;
            }
            if (chunk.length > leftToInflate) {
              chunk = chunk.slice(0, leftToInflate);
            }
            leftToInflate -= chunk.length;
            filterWrite(chunk);
          });
          this._inflate.on("end", this._filter.end.bind(this._filter));
        }
      }
      this._inflate.write(data);
    };
    ParserAsync.prototype._handleMetaData = function(metaData) {
      this._metaData = metaData;
      this._bitmapInfo = Object.create(metaData);
      this._filter = new FilterAsync(this._bitmapInfo);
    };
    ParserAsync.prototype._handleTransColor = function(transColor) {
      this._bitmapInfo.transColor = transColor;
    };
    ParserAsync.prototype._handlePalette = function(palette) {
      this._bitmapInfo.palette = palette;
    };
    ParserAsync.prototype._simpleTransparency = function() {
      this._metaData.alpha = true;
    };
    ParserAsync.prototype._headersFinished = function() {
      this.emit("metadata", this._metaData);
    };
    ParserAsync.prototype._finished = function() {
      if (this.errord) {
        return;
      }
      if (!this._inflate) {
        this.emit("error", "No Inflate block");
      } else {
        this._inflate.end();
      }
    };
    ParserAsync.prototype._complete = function(filteredData) {
      if (this.errord) {
        return;
      }
      let normalisedBitmapData;
      try {
        let bitmapData = bitmapper.dataToBitMap(filteredData, this._bitmapInfo);
        normalisedBitmapData = formatNormaliser(bitmapData, this._bitmapInfo);
        bitmapData = null;
      } catch (ex) {
        this._handleError(ex);
        return;
      }
      this.emit("parsed", normalisedBitmapData);
    };
  }
});

// node_modules/pngjs/lib/bitpacker.js
var require_bitpacker = __commonJS({
  "node_modules/pngjs/lib/bitpacker.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    module2.exports = function(dataIn, width, height, options) {
      let outHasAlpha = [constants.COLORTYPE_COLOR_ALPHA, constants.COLORTYPE_ALPHA].indexOf(
        options.colorType
      ) !== -1;
      if (options.colorType === options.inputColorType) {
        let bigEndian = (function() {
          let buffer = new ArrayBuffer(2);
          new DataView(buffer).setInt16(
            0,
            256,
            true
            /* littleEndian */
          );
          return new Int16Array(buffer)[0] !== 256;
        })();
        if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) {
          return dataIn;
        }
      }
      let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
      let maxValue = 255;
      let inBpp = constants.COLORTYPE_TO_BPP_MAP[options.inputColorType];
      if (inBpp === 4 && !options.inputHasAlpha) {
        inBpp = 3;
      }
      let outBpp = constants.COLORTYPE_TO_BPP_MAP[options.colorType];
      if (options.bitDepth === 16) {
        maxValue = 65535;
        outBpp *= 2;
      }
      let outData = Buffer.alloc(width * height * outBpp);
      let inIndex = 0;
      let outIndex = 0;
      let bgColor = options.bgColor || {};
      if (bgColor.red === void 0) {
        bgColor.red = maxValue;
      }
      if (bgColor.green === void 0) {
        bgColor.green = maxValue;
      }
      if (bgColor.blue === void 0) {
        bgColor.blue = maxValue;
      }
      function getRGBA() {
        let red;
        let green;
        let blue;
        let alpha = maxValue;
        switch (options.inputColorType) {
          case constants.COLORTYPE_COLOR_ALPHA:
            alpha = data[inIndex + 3];
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_COLOR:
            red = data[inIndex];
            green = data[inIndex + 1];
            blue = data[inIndex + 2];
            break;
          case constants.COLORTYPE_ALPHA:
            alpha = data[inIndex + 1];
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          case constants.COLORTYPE_GRAYSCALE:
            red = data[inIndex];
            green = red;
            blue = red;
            break;
          default:
            throw new Error(
              "input color type:" + options.inputColorType + " is not supported at present"
            );
        }
        if (options.inputHasAlpha) {
          if (!outHasAlpha) {
            alpha /= maxValue;
            red = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0),
              maxValue
            );
            green = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0),
              maxValue
            );
            blue = Math.min(
              Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0),
              maxValue
            );
          }
        }
        return { red, green, blue, alpha };
      }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let rgba = getRGBA(data, inIndex);
          switch (options.colorType) {
            case constants.COLORTYPE_COLOR_ALPHA:
            case constants.COLORTYPE_COLOR:
              if (options.bitDepth === 8) {
                outData[outIndex] = rgba.red;
                outData[outIndex + 1] = rgba.green;
                outData[outIndex + 2] = rgba.blue;
                if (outHasAlpha) {
                  outData[outIndex + 3] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(rgba.red, outIndex);
                outData.writeUInt16BE(rgba.green, outIndex + 2);
                outData.writeUInt16BE(rgba.blue, outIndex + 4);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 6);
                }
              }
              break;
            case constants.COLORTYPE_ALPHA:
            case constants.COLORTYPE_GRAYSCALE: {
              let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
              if (options.bitDepth === 8) {
                outData[outIndex] = grayscale;
                if (outHasAlpha) {
                  outData[outIndex + 1] = rgba.alpha;
                }
              } else {
                outData.writeUInt16BE(grayscale, outIndex);
                if (outHasAlpha) {
                  outData.writeUInt16BE(rgba.alpha, outIndex + 2);
                }
              }
              break;
            }
            default:
              throw new Error("unrecognised color Type " + options.colorType);
          }
          inIndex += inBpp;
          outIndex += outBpp;
        }
      }
      return outData;
    };
  }
});

// node_modules/pngjs/lib/filter-pack.js
var require_filter_pack = __commonJS({
  "node_modules/pngjs/lib/filter-pack.js"(exports2, module2) {
    "use strict";
    var paethPredictor = require_paeth_predictor();
    function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (let x = 0; x < byteWidth; x++) {
        rawData[rawPos + x] = pxData[pxPos + x];
      }
    }
    function filterSumNone(pxData, pxPos, byteWidth) {
      let sum = 0;
      let length = pxPos + byteWidth;
      for (let i = pxPos; i < length; i++) {
        sum += Math.abs(pxData[i]);
      }
      return sum;
    }
    function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let val = pxData[pxPos + x] - left;
        rawData[rawPos + x] = val;
      }
    }
    function filterSumSub(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let val = pxData[pxPos + x] - left;
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
      for (let x = 0; x < byteWidth; x++) {
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - up;
        rawData[rawPos + x] = val;
      }
    }
    function filterSumUp(pxData, pxPos, byteWidth) {
      let sum = 0;
      let length = pxPos + byteWidth;
      for (let x = pxPos; x < length; x++) {
        let up = pxPos > 0 ? pxData[x - byteWidth] : 0;
        let val = pxData[x] - up;
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - (left + up >> 1);
        rawData[rawPos + x] = val;
      }
    }
    function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let val = pxData[pxPos + x] - (left + up >> 1);
        sum += Math.abs(val);
      }
      return sum;
    }
    function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
        let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
        rawData[rawPos + x] = val;
      }
    }
    function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
      let sum = 0;
      for (let x = 0; x < byteWidth; x++) {
        let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
        let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
        let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
        let val = pxData[pxPos + x] - paethPredictor(left, up, upleft);
        sum += Math.abs(val);
      }
      return sum;
    }
    var filters = {
      0: filterNone,
      1: filterSub,
      2: filterUp,
      3: filterAvg,
      4: filterPaeth
    };
    var filterSums = {
      0: filterSumNone,
      1: filterSumSub,
      2: filterSumUp,
      3: filterSumAvg,
      4: filterSumPaeth
    };
    module2.exports = function(pxData, width, height, options, bpp) {
      let filterTypes;
      if (!("filterType" in options) || options.filterType === -1) {
        filterTypes = [0, 1, 2, 3, 4];
      } else if (typeof options.filterType === "number") {
        filterTypes = [options.filterType];
      } else {
        throw new Error("unrecognised filter types");
      }
      if (options.bitDepth === 16) {
        bpp *= 2;
      }
      let byteWidth = width * bpp;
      let rawPos = 0;
      let pxPos = 0;
      let rawData = Buffer.alloc((byteWidth + 1) * height);
      let sel = filterTypes[0];
      for (let y = 0; y < height; y++) {
        if (filterTypes.length > 1) {
          let min = Infinity;
          for (let i = 0; i < filterTypes.length; i++) {
            let sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
            if (sum < min) {
              sel = filterTypes[i];
              min = sum;
            }
          }
        }
        rawData[rawPos] = sel;
        rawPos++;
        filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
        rawPos += byteWidth;
        pxPos += byteWidth;
      }
      return rawData;
    };
  }
});

// node_modules/pngjs/lib/packer.js
var require_packer = __commonJS({
  "node_modules/pngjs/lib/packer.js"(exports2, module2) {
    "use strict";
    var constants = require_constants();
    var CrcStream = require_crc();
    var bitPacker = require_bitpacker();
    var filter = require_filter_pack();
    var zlib = require("zlib");
    var Packer = module2.exports = function(options) {
      this._options = options;
      options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
      options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
      options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
      options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
      options.deflateFactory = options.deflateFactory || zlib.createDeflate;
      options.bitDepth = options.bitDepth || 8;
      options.colorType = typeof options.colorType === "number" ? options.colorType : constants.COLORTYPE_COLOR_ALPHA;
      options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants.COLORTYPE_COLOR_ALPHA;
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.colorType) === -1) {
        throw new Error(
          "option color type:" + options.colorType + " is not supported at present"
        );
      }
      if ([
        constants.COLORTYPE_GRAYSCALE,
        constants.COLORTYPE_COLOR,
        constants.COLORTYPE_COLOR_ALPHA,
        constants.COLORTYPE_ALPHA
      ].indexOf(options.inputColorType) === -1) {
        throw new Error(
          "option input color type:" + options.inputColorType + " is not supported at present"
        );
      }
      if (options.bitDepth !== 8 && options.bitDepth !== 16) {
        throw new Error(
          "option bit depth:" + options.bitDepth + " is not supported at present"
        );
      }
    };
    Packer.prototype.getDeflateOptions = function() {
      return {
        chunkSize: this._options.deflateChunkSize,
        level: this._options.deflateLevel,
        strategy: this._options.deflateStrategy
      };
    };
    Packer.prototype.createDeflate = function() {
      return this._options.deflateFactory(this.getDeflateOptions());
    };
    Packer.prototype.filterData = function(data, width, height) {
      let packedData = bitPacker(data, width, height, this._options);
      let bpp = constants.COLORTYPE_TO_BPP_MAP[this._options.colorType];
      let filteredData = filter(packedData, width, height, this._options, bpp);
      return filteredData;
    };
    Packer.prototype._packChunk = function(type, data) {
      let len = data ? data.length : 0;
      let buf = Buffer.alloc(len + 12);
      buf.writeUInt32BE(len, 0);
      buf.writeUInt32BE(type, 4);
      if (data) {
        data.copy(buf, 8);
      }
      buf.writeInt32BE(
        CrcStream.crc32(buf.slice(4, buf.length - 4)),
        buf.length - 4
      );
      return buf;
    };
    Packer.prototype.packGAMA = function(gamma) {
      let buf = Buffer.alloc(4);
      buf.writeUInt32BE(Math.floor(gamma * constants.GAMMA_DIVISION), 0);
      return this._packChunk(constants.TYPE_gAMA, buf);
    };
    Packer.prototype.packIHDR = function(width, height) {
      let buf = Buffer.alloc(13);
      buf.writeUInt32BE(width, 0);
      buf.writeUInt32BE(height, 4);
      buf[8] = this._options.bitDepth;
      buf[9] = this._options.colorType;
      buf[10] = 0;
      buf[11] = 0;
      buf[12] = 0;
      return this._packChunk(constants.TYPE_IHDR, buf);
    };
    Packer.prototype.packIDAT = function(data) {
      return this._packChunk(constants.TYPE_IDAT, data);
    };
    Packer.prototype.packIEND = function() {
      return this._packChunk(constants.TYPE_IEND, null);
    };
  }
});

// node_modules/pngjs/lib/packer-async.js
var require_packer_async = __commonJS({
  "node_modules/pngjs/lib/packer-async.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var constants = require_constants();
    var Packer = require_packer();
    var PackerAsync = module2.exports = function(opt) {
      Stream.call(this);
      let options = opt || {};
      this._packer = new Packer(options);
      this._deflate = this._packer.createDeflate();
      this.readable = true;
    };
    util.inherits(PackerAsync, Stream);
    PackerAsync.prototype.pack = function(data, width, height, gamma) {
      this.emit("data", Buffer.from(constants.PNG_SIGNATURE));
      this.emit("data", this._packer.packIHDR(width, height));
      if (gamma) {
        this.emit("data", this._packer.packGAMA(gamma));
      }
      let filteredData = this._packer.filterData(data, width, height);
      this._deflate.on("error", this.emit.bind(this, "error"));
      this._deflate.on(
        "data",
        function(compressedData) {
          this.emit("data", this._packer.packIDAT(compressedData));
        }.bind(this)
      );
      this._deflate.on(
        "end",
        function() {
          this.emit("data", this._packer.packIEND());
          this.emit("end");
        }.bind(this)
      );
      this._deflate.end(filteredData);
    };
  }
});

// node_modules/pngjs/lib/sync-inflate.js
var require_sync_inflate = __commonJS({
  "node_modules/pngjs/lib/sync-inflate.js"(exports2, module2) {
    "use strict";
    var assert = require("assert").ok;
    var zlib = require("zlib");
    var util = require("util");
    var kMaxLength = require("buffer").kMaxLength;
    function Inflate(opts) {
      if (!(this instanceof Inflate)) {
        return new Inflate(opts);
      }
      if (opts && opts.chunkSize < zlib.Z_MIN_CHUNK) {
        opts.chunkSize = zlib.Z_MIN_CHUNK;
      }
      zlib.Inflate.call(this, opts);
      this._offset = this._offset === void 0 ? this._outOffset : this._offset;
      this._buffer = this._buffer || this._outBuffer;
      if (opts && opts.maxLength != null) {
        this._maxLength = opts.maxLength;
      }
    }
    function createInflate(opts) {
      return new Inflate(opts);
    }
    function _close(engine, callback) {
      if (callback) {
        process.nextTick(callback);
      }
      if (!engine._handle) {
        return;
      }
      engine._handle.close();
      engine._handle = null;
    }
    Inflate.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
      if (typeof asyncCb === "function") {
        return zlib.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
      }
      let self = this;
      let availInBefore = chunk && chunk.length;
      let availOutBefore = this._chunkSize - this._offset;
      let leftToInflate = this._maxLength;
      let inOff = 0;
      let buffers = [];
      let nread = 0;
      let error;
      this.on("error", function(err) {
        error = err;
      });
      function handleChunk(availInAfter, availOutAfter) {
        if (self._hadError) {
          return;
        }
        let have = availOutBefore - availOutAfter;
        assert(have >= 0, "have should not go down");
        if (have > 0) {
          let out = self._buffer.slice(self._offset, self._offset + have);
          self._offset += have;
          if (out.length > leftToInflate) {
            out = out.slice(0, leftToInflate);
          }
          buffers.push(out);
          nread += out.length;
          leftToInflate -= out.length;
          if (leftToInflate === 0) {
            return false;
          }
        }
        if (availOutAfter === 0 || self._offset >= self._chunkSize) {
          availOutBefore = self._chunkSize;
          self._offset = 0;
          self._buffer = Buffer.allocUnsafe(self._chunkSize);
        }
        if (availOutAfter === 0) {
          inOff += availInBefore - availInAfter;
          availInBefore = availInAfter;
          return true;
        }
        return false;
      }
      assert(this._handle, "zlib binding closed");
      let res;
      do {
        res = this._handle.writeSync(
          flushFlag,
          chunk,
          // in
          inOff,
          // in_off
          availInBefore,
          // in_len
          this._buffer,
          // out
          this._offset,
          //out_off
          availOutBefore
        );
        res = res || this._writeState;
      } while (!this._hadError && handleChunk(res[0], res[1]));
      if (this._hadError) {
        throw error;
      }
      if (nread >= kMaxLength) {
        _close(this);
        throw new RangeError(
          "Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes"
        );
      }
      let buf = Buffer.concat(buffers, nread);
      _close(this);
      return buf;
    };
    util.inherits(Inflate, zlib.Inflate);
    function zlibBufferSync(engine, buffer) {
      if (typeof buffer === "string") {
        buffer = Buffer.from(buffer);
      }
      if (!(buffer instanceof Buffer)) {
        throw new TypeError("Not a string or buffer");
      }
      let flushFlag = engine._finishFlushFlag;
      if (flushFlag == null) {
        flushFlag = zlib.Z_FINISH;
      }
      return engine._processChunk(buffer, flushFlag);
    }
    function inflateSync(buffer, opts) {
      return zlibBufferSync(new Inflate(opts), buffer);
    }
    module2.exports = exports2 = inflateSync;
    exports2.Inflate = Inflate;
    exports2.createInflate = createInflate;
    exports2.inflateSync = inflateSync;
  }
});

// node_modules/pngjs/lib/sync-reader.js
var require_sync_reader = __commonJS({
  "node_modules/pngjs/lib/sync-reader.js"(exports2, module2) {
    "use strict";
    var SyncReader = module2.exports = function(buffer) {
      this._buffer = buffer;
      this._reads = [];
    };
    SyncReader.prototype.read = function(length, callback) {
      this._reads.push({
        length: Math.abs(length),
        // if length < 0 then at most this length
        allowLess: length < 0,
        func: callback
      });
    };
    SyncReader.prototype.process = function() {
      while (this._reads.length > 0 && this._buffer.length) {
        let read = this._reads[0];
        if (this._buffer.length && (this._buffer.length >= read.length || read.allowLess)) {
          this._reads.shift();
          let buf = this._buffer;
          this._buffer = buf.slice(read.length);
          read.func.call(this, buf.slice(0, read.length));
        } else {
          break;
        }
      }
      if (this._reads.length > 0) {
        return new Error("There are some read requests waitng on finished stream");
      }
      if (this._buffer.length > 0) {
        return new Error("unrecognised content at end of stream");
      }
    };
  }
});

// node_modules/pngjs/lib/filter-parse-sync.js
var require_filter_parse_sync = __commonJS({
  "node_modules/pngjs/lib/filter-parse-sync.js"(exports2) {
    "use strict";
    var SyncReader = require_sync_reader();
    var Filter = require_filter_parse();
    exports2.process = function(inBuffer, bitmapInfo) {
      let outBuffers = [];
      let reader = new SyncReader(inBuffer);
      let filter = new Filter(bitmapInfo, {
        read: reader.read.bind(reader),
        write: function(bufferPart) {
          outBuffers.push(bufferPart);
        },
        complete: function() {
        }
      });
      filter.start();
      reader.process();
      return Buffer.concat(outBuffers);
    };
  }
});

// node_modules/pngjs/lib/parser-sync.js
var require_parser_sync = __commonJS({
  "node_modules/pngjs/lib/parser-sync.js"(exports2, module2) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = require("zlib");
    var inflateSync = require_sync_inflate();
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var SyncReader = require_sync_reader();
    var FilterSync = require_filter_parse_sync();
    var Parser = require_parser();
    var bitmapper = require_bitmapper();
    var formatNormaliser = require_format_normaliser();
    module2.exports = function(buffer, options) {
      if (!hasSyncZlib) {
        throw new Error(
          "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
        );
      }
      let err;
      function handleError(_err_) {
        err = _err_;
      }
      let metaData;
      function handleMetaData(_metaData_) {
        metaData = _metaData_;
      }
      function handleTransColor(transColor) {
        metaData.transColor = transColor;
      }
      function handlePalette(palette) {
        metaData.palette = palette;
      }
      function handleSimpleTransparency() {
        metaData.alpha = true;
      }
      let gamma;
      function handleGamma(_gamma_) {
        gamma = _gamma_;
      }
      let inflateDataList = [];
      function handleInflateData(inflatedData2) {
        inflateDataList.push(inflatedData2);
      }
      let reader = new SyncReader(buffer);
      let parser = new Parser(options, {
        read: reader.read.bind(reader),
        error: handleError,
        metadata: handleMetaData,
        gamma: handleGamma,
        palette: handlePalette,
        transColor: handleTransColor,
        inflateData: handleInflateData,
        simpleTransparency: handleSimpleTransparency
      });
      parser.start();
      reader.process();
      if (err) {
        throw err;
      }
      let inflateData = Buffer.concat(inflateDataList);
      inflateDataList.length = 0;
      let inflatedData;
      if (metaData.interlace) {
        inflatedData = zlib.inflateSync(inflateData);
      } else {
        let rowSize = (metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1;
        let imageSize = rowSize * metaData.height;
        inflatedData = inflateSync(inflateData, {
          chunkSize: imageSize,
          maxLength: imageSize
        });
      }
      inflateData = null;
      if (!inflatedData || !inflatedData.length) {
        throw new Error("bad png - invalid inflate data response");
      }
      let unfilteredData = FilterSync.process(inflatedData, metaData);
      inflateData = null;
      let bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
      unfilteredData = null;
      let normalisedBitmapData = formatNormaliser(bitmapData, metaData);
      metaData.data = normalisedBitmapData;
      metaData.gamma = gamma || 0;
      return metaData;
    };
  }
});

// node_modules/pngjs/lib/packer-sync.js
var require_packer_sync = __commonJS({
  "node_modules/pngjs/lib/packer-sync.js"(exports2, module2) {
    "use strict";
    var hasSyncZlib = true;
    var zlib = require("zlib");
    if (!zlib.deflateSync) {
      hasSyncZlib = false;
    }
    var constants = require_constants();
    var Packer = require_packer();
    module2.exports = function(metaData, opt) {
      if (!hasSyncZlib) {
        throw new Error(
          "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
        );
      }
      let options = opt || {};
      let packer = new Packer(options);
      let chunks = [];
      chunks.push(Buffer.from(constants.PNG_SIGNATURE));
      chunks.push(packer.packIHDR(metaData.width, metaData.height));
      if (metaData.gamma) {
        chunks.push(packer.packGAMA(metaData.gamma));
      }
      let filteredData = packer.filterData(
        metaData.data,
        metaData.width,
        metaData.height
      );
      let compressedData = zlib.deflateSync(
        filteredData,
        packer.getDeflateOptions()
      );
      filteredData = null;
      if (!compressedData || !compressedData.length) {
        throw new Error("bad png - invalid compressed data response");
      }
      chunks.push(packer.packIDAT(compressedData));
      chunks.push(packer.packIEND());
      return Buffer.concat(chunks);
    };
  }
});

// node_modules/pngjs/lib/png-sync.js
var require_png_sync = __commonJS({
  "node_modules/pngjs/lib/png-sync.js"(exports2) {
    "use strict";
    var parse = require_parser_sync();
    var pack = require_packer_sync();
    exports2.read = function(buffer, options) {
      return parse(buffer, options || {});
    };
    exports2.write = function(png, options) {
      return pack(png, options);
    };
  }
});

// node_modules/pngjs/lib/png.js
var require_png = __commonJS({
  "node_modules/pngjs/lib/png.js"(exports2) {
    "use strict";
    var util = require("util");
    var Stream = require("stream");
    var Parser = require_parser_async();
    var Packer = require_packer_async();
    var PNGSync = require_png_sync();
    var PNG = exports2.PNG = function(options) {
      Stream.call(this);
      options = options || {};
      this.width = options.width | 0;
      this.height = options.height | 0;
      this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null;
      if (options.fill && this.data) {
        this.data.fill(0);
      }
      this.gamma = 0;
      this.readable = this.writable = true;
      this._parser = new Parser(options);
      this._parser.on("error", this.emit.bind(this, "error"));
      this._parser.on("close", this._handleClose.bind(this));
      this._parser.on("metadata", this._metadata.bind(this));
      this._parser.on("gamma", this._gamma.bind(this));
      this._parser.on(
        "parsed",
        function(data) {
          this.data = data;
          this.emit("parsed", data);
        }.bind(this)
      );
      this._packer = new Packer(options);
      this._packer.on("data", this.emit.bind(this, "data"));
      this._packer.on("end", this.emit.bind(this, "end"));
      this._parser.on("close", this._handleClose.bind(this));
      this._packer.on("error", this.emit.bind(this, "error"));
    };
    util.inherits(PNG, Stream);
    PNG.sync = PNGSync;
    PNG.prototype.pack = function() {
      if (!this.data || !this.data.length) {
        this.emit("error", "No data provided");
        return this;
      }
      process.nextTick(
        function() {
          this._packer.pack(this.data, this.width, this.height, this.gamma);
        }.bind(this)
      );
      return this;
    };
    PNG.prototype.parse = function(data, callback) {
      if (callback) {
        let onParsed, onError;
        onParsed = function(parsedData) {
          this.removeListener("error", onError);
          this.data = parsedData;
          callback(null, this);
        }.bind(this);
        onError = function(err) {
          this.removeListener("parsed", onParsed);
          callback(err, null);
        }.bind(this);
        this.once("parsed", onParsed);
        this.once("error", onError);
      }
      this.end(data);
      return this;
    };
    PNG.prototype.write = function(data) {
      this._parser.write(data);
      return true;
    };
    PNG.prototype.end = function(data) {
      this._parser.end(data);
    };
    PNG.prototype._metadata = function(metadata) {
      this.width = metadata.width;
      this.height = metadata.height;
      this.emit("metadata", metadata);
    };
    PNG.prototype._gamma = function(gamma) {
      this.gamma = gamma;
    };
    PNG.prototype._handleClose = function() {
      if (!this._parser.writable && !this._packer.readable) {
        this.emit("close");
      }
    };
    PNG.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
      srcX |= 0;
      srcY |= 0;
      width |= 0;
      height |= 0;
      deltaX |= 0;
      deltaY |= 0;
      if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) {
        throw new Error("bitblt reading outside image");
      }
      if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) {
        throw new Error("bitblt writing outside image");
      }
      for (let y = 0; y < height; y++) {
        src.data.copy(
          dst.data,
          (deltaY + y) * dst.width + deltaX << 2,
          (srcY + y) * src.width + srcX << 2,
          (srcY + y) * src.width + srcX + width << 2
        );
      }
    };
    PNG.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
      PNG.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
      return this;
    };
    PNG.adjustGamma = function(src) {
      if (src.gamma) {
        for (let y = 0; y < src.height; y++) {
          for (let x = 0; x < src.width; x++) {
            let idx = src.width * y + x << 2;
            for (let i = 0; i < 3; i++) {
              let sample2 = src.data[idx + i] / 255;
              sample2 = Math.pow(sample2, 1 / 2.2 / src.gamma);
              src.data[idx + i] = Math.round(sample2 * 255);
            }
          }
        }
        src.gamma = 0;
      }
    };
    PNG.prototype.adjustGamma = function() {
      PNG.adjustGamma(this);
    };
  }
});

// node_modules/qrcode/lib/renderer/utils.js
var require_utils2 = __commonJS({
  "node_modules/qrcode/lib/renderer/utils.js"(exports2) {
    function hex2rgba(hex) {
      if (typeof hex === "number") {
        hex = hex.toString();
      }
      if (typeof hex !== "string") {
        throw new Error("Color should be defined as hex string");
      }
      let hexCode = hex.slice().replace("#", "").split("");
      if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) {
        throw new Error("Invalid hex color: " + hex);
      }
      if (hexCode.length === 3 || hexCode.length === 4) {
        hexCode = Array.prototype.concat.apply([], hexCode.map(function(c) {
          return [c, c];
        }));
      }
      if (hexCode.length === 6) hexCode.push("F", "F");
      const hexValue = parseInt(hexCode.join(""), 16);
      return {
        r: hexValue >> 24 & 255,
        g: hexValue >> 16 & 255,
        b: hexValue >> 8 & 255,
        a: hexValue & 255,
        hex: "#" + hexCode.slice(0, 6).join("")
      };
    }
    exports2.getOptions = function getOptions(options) {
      if (!options) options = {};
      if (!options.color) options.color = {};
      const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
      const width = options.width && options.width >= 21 ? options.width : void 0;
      const scale = options.scale || 4;
      return {
        width,
        scale: width ? 4 : scale,
        margin,
        color: {
          dark: hex2rgba(options.color.dark || "#000000ff"),
          light: hex2rgba(options.color.light || "#ffffffff")
        },
        type: options.type,
        rendererOpts: options.rendererOpts || {}
      };
    };
    exports2.getScale = function getScale(qrSize, opts) {
      return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
    };
    exports2.getImageWidth = function getImageWidth(qrSize, opts) {
      const scale = exports2.getScale(qrSize, opts);
      return Math.floor((qrSize + opts.margin * 2) * scale);
    };
    exports2.qrToImageData = function qrToImageData(imgData, qr, opts) {
      const size = qr.modules.size;
      const data = qr.modules.data;
      const scale = exports2.getScale(size, opts);
      const symbolSize = Math.floor((size + opts.margin * 2) * scale);
      const scaledMargin = opts.margin * scale;
      const palette = [opts.color.light, opts.color.dark];
      for (let i = 0; i < symbolSize; i++) {
        for (let j = 0; j < symbolSize; j++) {
          let posDst = (i * symbolSize + j) * 4;
          let pxColor = opts.color.light;
          if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
            const iSrc = Math.floor((i - scaledMargin) / scale);
            const jSrc = Math.floor((j - scaledMargin) / scale);
            pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
          }
          imgData[posDst++] = pxColor.r;
          imgData[posDst++] = pxColor.g;
          imgData[posDst++] = pxColor.b;
          imgData[posDst] = pxColor.a;
        }
      }
    };
  }
});

// node_modules/qrcode/lib/renderer/png.js
var require_png2 = __commonJS({
  "node_modules/qrcode/lib/renderer/png.js"(exports2) {
    var fs = require("fs");
    var PNG = require_png().PNG;
    var Utils = require_utils2();
    exports2.render = function render(qrData, options) {
      const opts = Utils.getOptions(options);
      const pngOpts = opts.rendererOpts;
      const size = Utils.getImageWidth(qrData.modules.size, opts);
      pngOpts.width = size;
      pngOpts.height = size;
      const pngImage = new PNG(pngOpts);
      Utils.qrToImageData(pngImage.data, qrData, opts);
      return pngImage;
    };
    exports2.renderToDataURL = function renderToDataURL(qrData, options, cb) {
      if (typeof cb === "undefined") {
        cb = options;
        options = void 0;
      }
      exports2.renderToBuffer(qrData, options, function(err, output) {
        if (err) cb(err);
        let url = "data:image/png;base64,";
        url += output.toString("base64");
        cb(null, url);
      });
    };
    exports2.renderToBuffer = function renderToBuffer(qrData, options, cb) {
      if (typeof cb === "undefined") {
        cb = options;
        options = void 0;
      }
      const png = exports2.render(qrData, options);
      const buffer = [];
      png.on("error", cb);
      png.on("data", function(data) {
        buffer.push(data);
      });
      png.on("end", function() {
        cb(null, Buffer.concat(buffer));
      });
      png.pack();
    };
    exports2.renderToFile = function renderToFile(path, qrData, options, cb) {
      if (typeof cb === "undefined") {
        cb = options;
        options = void 0;
      }
      let called = false;
      const done = (...args) => {
        if (called) return;
        called = true;
        cb.apply(null, args);
      };
      const stream = fs.createWriteStream(path);
      stream.on("error", done);
      stream.on("close", done);
      exports2.renderToFileStream(stream, qrData, options);
    };
    exports2.renderToFileStream = function renderToFileStream(stream, qrData, options) {
      const png = exports2.render(qrData, options);
      png.pack().pipe(stream);
    };
  }
});

// node_modules/qrcode/lib/renderer/utf8.js
var require_utf8 = __commonJS({
  "node_modules/qrcode/lib/renderer/utf8.js"(exports2) {
    var Utils = require_utils2();
    var BLOCK_CHAR = {
      WW: " ",
      WB: "\u2584",
      BB: "\u2588",
      BW: "\u2580"
    };
    var INVERTED_BLOCK_CHAR = {
      BB: " ",
      BW: "\u2584",
      WW: "\u2588",
      WB: "\u2580"
    };
    function getBlockChar(top, bottom, blocks) {
      if (top && bottom) return blocks.BB;
      if (top && !bottom) return blocks.BW;
      if (!top && bottom) return blocks.WB;
      return blocks.WW;
    }
    exports2.render = function(qrData, options, cb) {
      const opts = Utils.getOptions(options);
      let blocks = BLOCK_CHAR;
      if (opts.color.dark.hex === "#ffffff" || opts.color.light.hex === "#000000") {
        blocks = INVERTED_BLOCK_CHAR;
      }
      const size = qrData.modules.size;
      const data = qrData.modules.data;
      let output = "";
      let hMargin = Array(size + opts.margin * 2 + 1).join(blocks.WW);
      hMargin = Array(opts.margin / 2 + 1).join(hMargin + "\n");
      const vMargin = Array(opts.margin + 1).join(blocks.WW);
      output += hMargin;
      for (let i = 0; i < size; i += 2) {
        output += vMargin;
        for (let j = 0; j < size; j++) {
          const topModule = data[i * size + j];
          const bottomModule = data[(i + 1) * size + j];
          output += getBlockChar(topModule, bottomModule, blocks);
        }
        output += vMargin + "\n";
      }
      output += hMargin.slice(0, -1);
      if (typeof cb === "function") {
        cb(null, output);
      }
      return output;
    };
    exports2.renderToFile = function renderToFile(path, qrData, options, cb) {
      if (typeof cb === "undefined") {
        cb = options;
        options = void 0;
      }
      const fs = require("fs");
      const utf8 = exports2.render(qrData, options);
      fs.writeFile(path, utf8, cb);
    };
  }
});

// node_modules/qrcode/lib/renderer/terminal/terminal.js
var require_terminal = __commonJS({
  "node_modules/qrcode/lib/renderer/terminal/terminal.js"(exports2) {
    exports2.render = function(qrData, options, cb) {
      const size = qrData.modules.size;
      const data = qrData.modules.data;
      const black = "\x1B[40m  \x1B[0m";
      const white = "\x1B[47m  \x1B[0m";
      let output = "";
      const hMargin = Array(size + 3).join(white);
      const vMargin = Array(2).join(white);
      output += hMargin + "\n";
      for (let i = 0; i < size; ++i) {
        output += white;
        for (let j = 0; j < size; j++) {
          output += data[i * size + j] ? black : white;
        }
        output += vMargin + "\n";
      }
      output += hMargin + "\n";
      if (typeof cb === "function") {
        cb(null, output);
      }
      return output;
    };
  }
});

// node_modules/qrcode/lib/renderer/terminal/terminal-small.js
var require_terminal_small = __commonJS({
  "node_modules/qrcode/lib/renderer/terminal/terminal-small.js"(exports2) {
    var backgroundWhite = "\x1B[47m";
    var backgroundBlack = "\x1B[40m";
    var foregroundWhite = "\x1B[37m";
    var foregroundBlack = "\x1B[30m";
    var reset = "\x1B[0m";
    var lineSetupNormal = backgroundWhite + foregroundBlack;
    var lineSetupInverse = backgroundBlack + foregroundWhite;
    var createPalette = function(lineSetup, foregroundWhite2, foregroundBlack2) {
      return {
        // 1 ... white, 2 ... black, 0 ... transparent (default)
        "00": reset + " " + lineSetup,
        "01": reset + foregroundWhite2 + "\u2584" + lineSetup,
        "02": reset + foregroundBlack2 + "\u2584" + lineSetup,
        10: reset + foregroundWhite2 + "\u2580" + lineSetup,
        11: " ",
        12: "\u2584",
        20: reset + foregroundBlack2 + "\u2580" + lineSetup,
        21: "\u2580",
        22: "\u2588"
      };
    };
    var mkCodePixel = function(modules, size, x, y) {
      const sizePlus = size + 1;
      if (x >= sizePlus || y >= sizePlus || y < -1 || x < -1) return "0";
      if (x >= size || y >= size || y < 0 || x < 0) return "1";
      const idx = y * size + x;
      return modules[idx] ? "2" : "1";
    };
    var mkCode = function(modules, size, x, y) {
      return mkCodePixel(modules, size, x, y) + mkCodePixel(modules, size, x, y + 1);
    };
    exports2.render = function(qrData, options, cb) {
      const size = qrData.modules.size;
      const data = qrData.modules.data;
      const inverse = !!(options && options.inverse);
      const lineSetup = options && options.inverse ? lineSetupInverse : lineSetupNormal;
      const white = inverse ? foregroundBlack : foregroundWhite;
      const black = inverse ? foregroundWhite : foregroundBlack;
      const palette = createPalette(lineSetup, white, black);
      const newLine = reset + "\n" + lineSetup;
      let output = lineSetup;
      for (let y = -1; y < size + 1; y += 2) {
        for (let x = -1; x < size; x++) {
          output += palette[mkCode(data, size, x, y)];
        }
        output += palette[mkCode(data, size, size, y)] + newLine;
      }
      output += reset;
      if (typeof cb === "function") {
        cb(null, output);
      }
      return output;
    };
  }
});

// node_modules/qrcode/lib/renderer/terminal.js
var require_terminal2 = __commonJS({
  "node_modules/qrcode/lib/renderer/terminal.js"(exports2) {
    var big = require_terminal();
    var small = require_terminal_small();
    exports2.render = function(qrData, options, cb) {
      if (options && options.small) {
        return small.render(qrData, options, cb);
      }
      return big.render(qrData, options, cb);
    };
  }
});

// node_modules/qrcode/lib/renderer/svg-tag.js
var require_svg_tag = __commonJS({
  "node_modules/qrcode/lib/renderer/svg-tag.js"(exports2) {
    var Utils = require_utils2();
    function getColorAttrib(color, attrib) {
      const alpha = color.a / 255;
      const str = attrib + '="' + color.hex + '"';
      return alpha < 1 ? str + " " + attrib + '-opacity="' + alpha.toFixed(2).slice(1) + '"' : str;
    }
    function svgCmd(cmd, x, y) {
      let str = cmd + x;
      if (typeof y !== "undefined") str += " " + y;
      return str;
    }
    function qrToPath(data, size, margin) {
      let path = "";
      let moveBy = 0;
      let newRow = false;
      let lineLength = 0;
      for (let i = 0; i < data.length; i++) {
        const col = Math.floor(i % size);
        const row = Math.floor(i / size);
        if (!col && !newRow) newRow = true;
        if (data[i]) {
          lineLength++;
          if (!(i > 0 && col > 0 && data[i - 1])) {
            path += newRow ? svgCmd("M", col + margin, 0.5 + row + margin) : svgCmd("m", moveBy, 0);
            moveBy = 0;
            newRow = false;
          }
          if (!(col + 1 < size && data[i + 1])) {
            path += svgCmd("h", lineLength);
            lineLength = 0;
          }
        } else {
          moveBy++;
        }
      }
      return path;
    }
    exports2.render = function render(qrData, options, cb) {
      const opts = Utils.getOptions(options);
      const size = qrData.modules.size;
      const data = qrData.modules.data;
      const qrcodesize = size + opts.margin * 2;
      const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + ' d="M0 0h' + qrcodesize + "v" + qrcodesize + 'H0z"/>';
      const path = "<path " + getColorAttrib(opts.color.dark, "stroke") + ' d="' + qrToPath(data, size, opts.margin) + '"/>';
      const viewBox = 'viewBox="0 0 ' + qrcodesize + " " + qrcodesize + '"';
      const width = !opts.width ? "" : 'width="' + opts.width + '" height="' + opts.width + '" ';
      const svgTag = '<svg xmlns="http://www.w3.org/2000/svg" ' + width + viewBox + ' shape-rendering="crispEdges">' + bg + path + "</svg>\n";
      if (typeof cb === "function") {
        cb(null, svgTag);
      }
      return svgTag;
    };
  }
});

// node_modules/qrcode/lib/renderer/svg.js
var require_svg = __commonJS({
  "node_modules/qrcode/lib/renderer/svg.js"(exports2) {
    var svgTagRenderer = require_svg_tag();
    exports2.render = svgTagRenderer.render;
    exports2.renderToFile = function renderToFile(path, qrData, options, cb) {
      if (typeof cb === "undefined") {
        cb = options;
        options = void 0;
      }
      const fs = require("fs");
      const svgTag = exports2.render(qrData, options);
      const xmlStr = '<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + svgTag;
      fs.writeFile(path, xmlStr, cb);
    };
  }
});

// node_modules/qrcode/lib/renderer/canvas.js
var require_canvas = __commonJS({
  "node_modules/qrcode/lib/renderer/canvas.js"(exports2) {
    var Utils = require_utils2();
    function clearCanvas(ctx, canvas, size) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!canvas.style) canvas.style = {};
      canvas.height = size;
      canvas.width = size;
      canvas.style.height = size + "px";
      canvas.style.width = size + "px";
    }
    function getCanvasElement() {
      try {
        return document.createElement("canvas");
      } catch (e) {
        throw new Error("You need to specify a canvas element");
      }
    }
    exports2.render = function render(qrData, canvas, options) {
      let opts = options;
      let canvasEl = canvas;
      if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
        opts = canvas;
        canvas = void 0;
      }
      if (!canvas) {
        canvasEl = getCanvasElement();
      }
      opts = Utils.getOptions(opts);
      const size = Utils.getImageWidth(qrData.modules.size, opts);
      const ctx = canvasEl.getContext("2d");
      const image = ctx.createImageData(size, size);
      Utils.qrToImageData(image.data, qrData, opts);
      clearCanvas(ctx, canvasEl, size);
      ctx.putImageData(image, 0, 0);
      return canvasEl;
    };
    exports2.renderToDataURL = function renderToDataURL(qrData, canvas, options) {
      let opts = options;
      if (typeof opts === "undefined" && (!canvas || !canvas.getContext)) {
        opts = canvas;
        canvas = void 0;
      }
      if (!opts) opts = {};
      const canvasEl = exports2.render(qrData, canvas, opts);
      const type = opts.type || "image/png";
      const rendererOpts = opts.rendererOpts || {};
      return canvasEl.toDataURL(type, rendererOpts.quality);
    };
  }
});

// node_modules/qrcode/lib/browser.js
var require_browser = __commonJS({
  "node_modules/qrcode/lib/browser.js"(exports2) {
    var canPromise = require_can_promise();
    var QRCode2 = require_qrcode();
    var CanvasRenderer = require_canvas();
    var SvgRenderer = require_svg_tag();
    function renderCanvas(renderFunc, canvas, text, opts, cb) {
      const args = [].slice.call(arguments, 1);
      const argsNum = args.length;
      const isLastArgCb = typeof args[argsNum - 1] === "function";
      if (!isLastArgCb && !canPromise()) {
        throw new Error("Callback required as last argument");
      }
      if (isLastArgCb) {
        if (argsNum < 2) {
          throw new Error("Too few arguments provided");
        }
        if (argsNum === 2) {
          cb = text;
          text = canvas;
          canvas = opts = void 0;
        } else if (argsNum === 3) {
          if (canvas.getContext && typeof cb === "undefined") {
            cb = opts;
            opts = void 0;
          } else {
            cb = opts;
            opts = text;
            text = canvas;
            canvas = void 0;
          }
        }
      } else {
        if (argsNum < 1) {
          throw new Error("Too few arguments provided");
        }
        if (argsNum === 1) {
          text = canvas;
          canvas = opts = void 0;
        } else if (argsNum === 2 && !canvas.getContext) {
          opts = text;
          text = canvas;
          canvas = void 0;
        }
        return new Promise(function(resolve4, reject) {
          try {
            const data = QRCode2.create(text, opts);
            resolve4(renderFunc(data, canvas, opts));
          } catch (e) {
            reject(e);
          }
        });
      }
      try {
        const data = QRCode2.create(text, opts);
        cb(null, renderFunc(data, canvas, opts));
      } catch (e) {
        cb(e);
      }
    }
    exports2.create = QRCode2.create;
    exports2.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
    exports2.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
    exports2.toString = renderCanvas.bind(null, function(data, _, opts) {
      return SvgRenderer.render(data, opts);
    });
  }
});

// node_modules/qrcode/lib/server.js
var require_server = __commonJS({
  "node_modules/qrcode/lib/server.js"(exports2) {
    var canPromise = require_can_promise();
    var QRCode2 = require_qrcode();
    var PngRenderer = require_png2();
    var Utf8Renderer = require_utf8();
    var TerminalRenderer = require_terminal2();
    var SvgRenderer = require_svg();
    function checkParams(text, opts, cb) {
      if (typeof text === "undefined") {
        throw new Error("String required as first argument");
      }
      if (typeof cb === "undefined") {
        cb = opts;
        opts = {};
      }
      if (typeof cb !== "function") {
        if (!canPromise()) {
          throw new Error("Callback required as last argument");
        } else {
          opts = cb || {};
          cb = null;
        }
      }
      return {
        opts,
        cb
      };
    }
    function getTypeFromFilename(path) {
      return path.slice((path.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
    }
    function getRendererFromType(type) {
      switch (type) {
        case "svg":
          return SvgRenderer;
        case "txt":
        case "utf8":
          return Utf8Renderer;
        case "png":
        case "image/png":
        default:
          return PngRenderer;
      }
    }
    function getStringRendererFromType(type) {
      switch (type) {
        case "svg":
          return SvgRenderer;
        case "terminal":
          return TerminalRenderer;
        case "utf8":
        default:
          return Utf8Renderer;
      }
    }
    function render(renderFunc, text, params) {
      if (!params.cb) {
        return new Promise(function(resolve4, reject) {
          try {
            const data = QRCode2.create(text, params.opts);
            return renderFunc(data, params.opts, function(err, data2) {
              return err ? reject(err) : resolve4(data2);
            });
          } catch (e) {
            reject(e);
          }
        });
      }
      try {
        const data = QRCode2.create(text, params.opts);
        return renderFunc(data, params.opts, params.cb);
      } catch (e) {
        params.cb(e);
      }
    }
    exports2.create = QRCode2.create;
    exports2.toCanvas = require_browser().toCanvas;
    exports2.toString = function toString(text, opts, cb) {
      const params = checkParams(text, opts, cb);
      const type = params.opts ? params.opts.type : void 0;
      const renderer = getStringRendererFromType(type);
      return render(renderer.render, text, params);
    };
    exports2.toDataURL = function toDataURL(text, opts, cb) {
      const params = checkParams(text, opts, cb);
      const renderer = getRendererFromType(params.opts.type);
      return render(renderer.renderToDataURL, text, params);
    };
    exports2.toBuffer = function toBuffer(text, opts, cb) {
      const params = checkParams(text, opts, cb);
      const renderer = getRendererFromType(params.opts.type);
      return render(renderer.renderToBuffer, text, params);
    };
    exports2.toFile = function toFile(path, text, opts, cb) {
      if (typeof path !== "string" || !(typeof text === "string" || typeof text === "object")) {
        throw new Error("Invalid argument");
      }
      if (arguments.length < 3 && !canPromise()) {
        throw new Error("Too few arguments provided");
      }
      const params = checkParams(text, opts, cb);
      const type = params.opts.type || getTypeFromFilename(path);
      const renderer = getRendererFromType(type);
      const renderToFile = renderer.renderToFile.bind(null, path);
      return render(renderToFile, text, params);
    };
    exports2.toFileStream = function toFileStream(stream, text, opts) {
      if (arguments.length < 2) {
        throw new Error("Too few arguments provided");
      }
      const params = checkParams(text, opts, stream.emit.bind(stream, "error"));
      const renderer = getRendererFromType("png");
      const renderToFileStream = renderer.renderToFileStream.bind(null, stream);
      render(renderToFileStream, text, params);
    };
  }
});

// node_modules/qrcode/lib/index.js
var require_lib = __commonJS({
  "node_modules/qrcode/lib/index.js"(exports2, module2) {
    module2.exports = require_server();
  }
});

// src/transcript/small-size-transcripts.ts
var DEFAULT_TRANSCRIPT_BYTE_LIMIT;
var init_small_size_transcripts = __esm({
  "src/transcript/small-size-transcripts.ts"() {
    "use strict";
    DEFAULT_TRANSCRIPT_BYTE_LIMIT = 6200;
  }
});

// src/utils/env.ts
function readEnv(key) {
  if (typeof process === "undefined" || !process.env) {
    return void 0;
  }
  return process.env[key];
}
var init_env = __esm({
  "src/utils/env.ts"() {
    "use strict";
  }
});

// src/utils/fp.ts
function sample(arr = []) {
  const list = arr ?? [];
  return list.length ? list[Math.floor(Math.random() * list.length)] : void 0;
}
function find(list = [], args) {
  const keys = Object.keys(args);
  if (keys.length === 0) {
    return void 0;
  }
  const key = keys[0];
  return list.find((item) => item[key] === args[key]);
}
function toStringArray(value) {
  if (value === void 0 || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value.split(",").filter(Boolean);
}
var init_fp = __esm({
  "src/utils/fp.ts"() {
    "use strict";
  }
});

// src/config.ts
function resolveSubtitleConfig(config = {}) {
  return {
    savesubsBaseUrl: config.savesubsBaseUrl ?? readEnv("SAVESUBS_BASE_URL") ?? DEFAULT_SAVESUBS_BASE_URL,
    savesubsAuthToken: config.savesubsAuthToken ?? readEnv("SAVESUBS_X_AUTH_TOKEN"),
    bilibiliSessionTokens: toStringArray(config.bilibiliSessionTokens ?? readEnv("BILIBILI_SESSION_TOKEN")),
    userAgent: config.userAgent ?? DEFAULT_USER_AGENT,
    transcriptByteLimit: config.transcriptByteLimit ?? DEFAULT_TRANSCRIPT_BYTE_LIMIT
  };
}
var DEFAULT_USER_AGENT, DEFAULT_SAVESUBS_BASE_URL;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    init_small_size_transcripts();
    init_env();
    init_fp();
    DEFAULT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36";
    DEFAULT_SAVESUBS_BASE_URL = "https://savesubs.com";
  }
});

// src/agent/auth.ts
async function privateJson(path, value) {
  await (0, import_promises.mkdir)((0, import_node_path.dirname)(path), { recursive: true, mode: 448 });
  const temp = `${path}.${(0, import_node_crypto.randomUUID)()}.tmp`;
  try {
    await (0, import_promises.writeFile)(temp, JSON.stringify(value, null, 2), { mode: 384, flag: "wx" });
    await (0, import_promises.rename)(temp, path);
  } finally {
    await (0, import_promises.rm)(temp, { force: true });
  }
}
async function request(url, init = {}, fetcher = fetch) {
  const response = await fetcher(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(2e4)]) : AbortSignal.timeout(2e4) });
  if (!response.ok) throw new Error(`UPSTREAM_HTTP_${response.status}`);
  return response;
}
function sessionValue(value) {
  const token = value.trim();
  if (!token || /[\s;\r\n]/.test(token) || token.startsWith("SESSDATA=")) {
    throw new Error("INVALID_SESSION: provide only the SESSDATA cookie value");
  }
  return token;
}
async function readSession(authFile, env = process.env) {
  if (env.BILIBILI_SESSION_TOKEN) return sessionValue(env.BILIBILI_SESSION_TOKEN);
  try {
    const stored = JSON.parse(await (0, import_promises.readFile)(authFile, "utf8"));
    return sessionValue(stored.SESSDATA);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error("AUTH_REQUIRED: run auth login or auth import");
    throw new Error("INVALID_AUTH_FILE: re-import SESSDATA or log in again");
  }
}
async function checkSession(token, fetcher = fetch) {
  const response = await request("https://api.bilibili.com/x/web-interface/nav", {
    headers: { ...headers, Cookie: `SESSDATA=${sessionValue(token)}` }
  }, fetcher);
  const result = await response.json();
  if (result.code !== 0 || result.data?.isLogin !== true) {
    throw new Error(`AUTH_INVALID: nav code ${result.code}; log in again`);
  }
  return { authenticated: true };
}
async function importSession(input, authFile, fetcher = fetch) {
  const trimmed = input.trim();
  let token;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed);
    const cookies = Array.isArray(json) ? json : json.cookies;
    token = Array.isArray(cookies) ? cookies.find((c) => c.name === "SESSDATA" && (!c.domain || /(^|\.)bilibili\.com$/.test(c.domain)))?.value : json.SESSDATA;
  } else if (trimmed.includes("	")) {
    token = trimmed.split(/\r?\n/).map((line) => line.replace(/^#HttpOnly_/, "").split("	")).find((parts) => /(^|\.)bilibili\.com$/.test(parts[0] ?? "") && parts[5] === "SESSDATA")?.[6];
  } else {
    token = /(?:^|;\s*)SESSDATA=([^;]+)/.exec(trimmed)?.[1] ?? trimmed;
  }
  if (typeof token !== "string") throw new Error("SESSDATA_NOT_FOUND");
  token = sessionValue(token);
  await checkSession(token, fetcher);
  await privateJson(authFile, { SESSDATA: token, savedAt: (/* @__PURE__ */ new Date()).toISOString() });
  return { authenticated: true, authFile };
}
async function startLogin(directory, fetcher = fetch) {
  const response = await request(`${passport}/generate`, { headers }, fetcher);
  const json = await response.json();
  if (json.code !== 0 || !json.data?.qrcode_key || !json.data.url) throw new Error("QR_GENERATE_FAILED");
  await (0, import_promises.mkdir)(directory, { recursive: false, mode: 448 });
  const stateFile = (0, import_node_path.join)(directory, "login.json");
  const qrFile = (0, import_node_path.join)(directory, "login.png");
  await privateJson(stateFile, { key: json.data.qrcode_key, createdAt: Date.now() });
  await (0, import_promises.writeFile)(qrFile, await import_qrcode.default.toBuffer(json.data.url, { width: 360 }), { mode: 384 });
  await (0, import_promises.chmod)(qrFile, 384);
  return { state: "waiting_for_scan", stateFile, qrFile };
}
async function pollLogin(stateFile, authFile, fetcher = fetch) {
  const state = JSON.parse(await (0, import_promises.readFile)(stateFile, "utf8"));
  if (typeof state.key !== "string" || !Number.isFinite(state.createdAt)) throw new Error("INVALID_QR_STATE");
  if (Date.now() - state.createdAt > 18e4) throw new Error("QR_EXPIRED: run auth login again");
  const response = await request(`${passport}/poll?qrcode_key=${encodeURIComponent(state.key)}`, { headers }, fetcher);
  const json = await response.json();
  if (json.code !== 0 || !json.data) throw new Error("QR_POLL_FAILED");
  if (json.data.code === 86101) return { state: "waiting_for_scan" };
  if (json.data.code === 86090) return { state: "waiting_for_confirmation" };
  if (json.data.code === 86038) throw new Error("QR_EXPIRED: run auth login again");
  if (json.data.code !== 0) throw new Error(`QR_UNKNOWN_STATE_${json.data.code}`);
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith("SESSDATA="));
  const token = cookie?.split(";")[0]?.slice("SESSDATA=".length);
  if (!token) throw new Error("QR_NO_SESSION: successful response lacked SESSDATA");
  const result = await importSession(token, authFile, fetcher);
  await (0, import_promises.rm)(stateFile, { force: true });
  await (0, import_promises.rm)((0, import_node_path.join)((0, import_node_path.dirname)(stateFile), "login.png"), { force: true });
  return { state: "authenticated", ...result };
}
var import_promises, import_node_path, import_node_os, import_node_crypto, import_qrcode, defaultAuthFile, passport, headers;
var init_auth = __esm({
  "src/agent/auth.ts"() {
    "use strict";
    import_promises = require("node:fs/promises");
    import_node_path = require("node:path");
    import_node_os = require("node:os");
    import_node_crypto = require("node:crypto");
    import_qrcode = __toESM(require_lib(), 1);
    init_config();
    defaultAuthFile = () => (0, import_node_path.join)((0, import_node_os.homedir)(), ".config", "video-summarizer", "bilibili.json");
    passport = "https://passport.bilibili.com/x/passport-login/web/qrcode";
    headers = { "User-Agent": DEFAULT_USER_AGENT, Referer: "https://www.bilibili.com/" };
  }
});

// src/errors.ts
var SummarizeError;
var init_errors = __esm({
  "src/errors.ts"() {
    "use strict";
    SummarizeError = class extends Error {
      statusCode;
      code;
      constructor(statusCode, code, message) {
        super(message);
        this.name = "SummarizeError";
        this.statusCode = statusCode;
        this.code = code;
      }
    };
  }
});

// src/transcription/process.ts
function runTool(command, args, stage, signal, timeout = 12e4) {
  if (signal?.aborted) return Promise.reject(new SummarizeError(499, "ASR_CANCELLED", "Local transcription cancelled"));
  return new Promise((done, reject) => {
    let output = "", cancelled2 = false, timedOut = false;
    const child = (0, import_node_child_process.spawn)(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (data) => {
      output = (output + data.toString()).slice(-1024 * 1024);
    });
    child.stderr.on("data", () => {
    });
    let killTimer;
    const stop = () => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 3e3);
      killTimer.unref();
    };
    const abort = () => {
      cancelled2 = true;
      stop();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeout);
    const clean = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", abort);
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.on("error", () => {
      clean();
      reject(new SummarizeError(500, "ASR_TOOL_FAILED", `${stage}: tool could not start`));
    });
    child.on("close", (code) => {
      clean();
      if (cancelled2) reject(new SummarizeError(499, "ASR_CANCELLED", "Local transcription cancelled"));
      else if (timedOut) reject(new SummarizeError(504, "ASR_TIMEOUT", `${stage}: timed out`));
      else if (code !== 0) reject(new SummarizeError(502, "ASR_TOOL_FAILED", `${stage}: tool failed (exit ${code})`));
      else done(output);
    });
  });
}
var import_node_child_process;
var init_process = __esm({
  "src/transcription/process.ts"() {
    "use strict";
    import_node_child_process = require("node:child_process");
    init_errors();
  }
});

// src/transcription/environment.ts
async function sha256File(path) {
  const hash = (0, import_node_crypto3.createHash)("sha256");
  for await (const data of (0, import_node_fs.createReadStream)(path)) hash.update(data);
  return hash.digest("hex");
}
function fingerprint(value) {
  return (0, import_node_crypto3.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
}
async function resolveLocalOptions(options = {}) {
  const configFile = (0, import_node_path3.resolve)(options.configFile ?? (0, import_node_path3.join)((0, import_node_os2.homedir)(), ".config/video-summarizer/asr.json"));
  let stored = {};
  try {
    stored = JSON.parse(await (0, import_promises3.readFile)(configFile, "utf8"));
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) throw new Error();
  } catch (error) {
    if (error.code !== "ENOENT") throw new SummarizeError(400, "ASR_CONFIG_INVALID", "Invalid local transcription configuration");
  }
  const model = options.model ?? stored.model ?? "small";
  if (!Object.hasOwn(LOCAL_MODELS, model)) throw new SummarizeError(400, "ASR_CONFIG_INVALID", "Use small or medium, or provide --model-path");
  const cacheDir = (0, import_node_path3.resolve)(options.cacheDir ?? stored.cacheDir ?? (0, import_node_path3.join)((0, import_node_os2.homedir)(), ".cache/video-summarizer"));
  const language = options.language ?? stored.language ?? "auto";
  if (!/^[a-z]{2,3}$/.test(language) && language !== "auto") throw new SummarizeError(400, "ASR_CONFIG_INVALID", "Use a Whisper language code or auto");
  const modelPath = (0, import_node_path3.resolve)(options.modelPath ?? (options.model ? void 0 : stored.modelPath) ?? (0, import_node_path3.join)(cacheDir, "models", `ggml-${model}.bin`));
  const tools = Object.fromEntries(Object.entries(commands).map(([key, command]) => [key, options.tools?.[key] ?? stored.tools?.[key] ?? command]));
  if (Object.values(tools).some((value) => typeof value !== "string" || !value.trim())) throw new SummarizeError(400, "ASR_CONFIG_INVALID", "Invalid tool path");
  return { model, modelPath, language, cacheDir, configFile, tools };
}
async function checkModel(path) {
  try {
    const info = await (0, import_promises3.stat)(path);
    if (!info.isFile() || info.size < 1024 * 1024) return { status: "invalid" };
    const file = await (0, import_promises3.open)(path, "r");
    const header = Buffer.alloc(8);
    try {
      await file.read(header, 0, 8, 0);
    } finally {
      await file.close();
    }
    if (header.readUInt32LE(0) !== 1734831468 || header.readUInt32LE(4) < 51865) return { status: "invalid" };
    const hash = await sha256File(path);
    const known = Object.entries(LOCAL_MODELS).find(([name]) => (0, import_node_path3.basename)(path) === `ggml-${name}.bin`)?.[1];
    if (known && (info.size !== known.bytes || hash !== known.sha256)) return { status: "invalid" };
    return { status: "ready", bytes: info.size, sha256: hash };
  } catch (error) {
    return { status: error.code === "ENOENT" ? "missing" : "invalid" };
  }
}
async function doctorLocalTranscription(options = {}) {
  const config = await resolveLocalOptions(options);
  const toolResults = await Promise.all(Object.entries(config.tools).map(async ([name, command]) => {
    let available = true;
    try {
      await runTool(command, [name === "ffmpeg" || name === "ffprobe" ? "-version" : "--version"], "doctor", options.signal, 15e3);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      available = false;
    }
    return { name, command, available };
  }));
  const model = { ...await checkModel(config.modelPath), path: config.modelPath, name: config.model };
  const missingTools = toolResults.filter((tool) => !tool.available).map((tool) => tool.name);
  let homebrewPrefix;
  if (missingTools.length && process.platform === "darwin") {
    try {
      homebrewPrefix = (await runTool("brew", ["--prefix"], "doctor", options.signal, 15e3)).trim() || void 0;
    } catch (error) {
      if (options.signal?.aborted) throw error;
    }
  }
  return {
    ready: missingTools.length === 0 && model.status === "ready",
    platform: process.platform,
    config,
    tools: toolResults,
    missingTools,
    model,
    downloadBytes: LOCAL_MODELS[config.model].bytes,
    installation: {
      toolPackages: [...new Set(missingTools.map(packageFor))],
      homebrewPrefix,
      modelDownloadBytes: model.status === "missing" ? LOCAL_MODELS[config.model].bytes : 0,
      modelUrl: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${config.model}.bin`
    },
    setupSupported: process.platform === "darwin",
    nextCommand: "asr setup"
  };
}
async function setupLocalTranscription(options = {}) {
  const before = await doctorLocalTranscription(options);
  const config = before.config;
  if (before.model.status === "invalid") throw new SummarizeError(400, "ASR_MODEL_INVALID", "Model is invalid; choose a valid model path or remove the damaged file before setup");
  if (before.missingTools.length) {
    if (process.platform !== "darwin") throw new SummarizeError(400, "ASR_SETUP_UNSUPPORTED", "Install tools manually on this platform, then run asr doctor");
    try {
      await runTool("brew", ["--version"], "Homebrew", options.signal);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new SummarizeError(400, "ASR_SETUP_UNSUPPORTED", "Homebrew is missing; prepare it manually or configure existing tool paths");
    }
    if (before.missingTools.some((tool) => config.tools[tool] !== commands[tool])) throw new SummarizeError(400, "ASR_CONFIG_INVALID", "Configured tool is unavailable; fix its path before installing");
    const packages = before.installation.toolPackages;
    options.onProgress?.({ stage: "install-tools", status: "started" });
    await runTool("brew", ["install", ...packages], "install-tools", options.signal, 18e5);
    options.onProgress?.({ stage: "install-tools", status: "complete" });
  }
  if (before.model.status === "missing") {
    if (options.modelPath || config.modelPath !== (0, import_node_path3.join)(config.cacheDir, "models", `ggml-${config.model}.bin`)) throw new SummarizeError(400, "ASR_MODEL_INVALID", "Specified model file is missing; provide an existing model or omit --model-path to download");
    await (0, import_promises3.mkdir)((0, import_node_path3.dirname)(config.modelPath), { recursive: true, mode: 448 });
    const temp = `${config.modelPath}.${(0, import_node_crypto3.randomUUID)()}.part`;
    options.onProgress?.({ stage: "download-model", status: "started" });
    try {
      const response = await fetch(`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${config.model}.bin`, { signal: options.signal ?? AbortSignal.timeout(18e5) });
      if (!response.ok || !response.body) throw new SummarizeError(502, "ASR_MODEL_DOWNLOAD_FAILED", `Model download HTTP ${response.status}`);
      await (0, import_promises4.pipeline)(import_node_stream.Readable.fromWeb(response.body), (0, import_node_fs.createWriteStream)(temp, { flags: "wx", mode: 384 }), { signal: options.signal });
      const expected = LOCAL_MODELS[config.model];
      if ((await (0, import_promises3.stat)(temp)).size !== expected.bytes || await sha256File(temp) !== expected.sha256) throw new SummarizeError(502, "ASR_MODEL_INVALID", "Downloaded model checksum failed");
      await (0, import_promises3.rename)(temp, config.modelPath);
    } catch (error) {
      if (error instanceof SummarizeError) throw error;
      throw new SummarizeError(options.signal?.aborted ? 499 : 502, options.signal?.aborted ? "ASR_CANCELLED" : "ASR_MODEL_DOWNLOAD_FAILED", "Model download interrupted; rerun setup");
    } finally {
      await (0, import_promises3.rm)(temp, { force: true });
    }
    options.onProgress?.({ stage: "download-model", status: "complete" });
  }
  const after = await doctorLocalTranscription({ ...options, ...config });
  if (!after.ready) throw new SummarizeError(500, "ASR_DEPENDENCIES_MISSING", "Setup incomplete; run asr doctor for missing items");
  await privateJson(config.configFile, config);
  return after;
}
var import_node_fs, import_promises3, import_node_os2, import_node_path3, import_node_crypto3, import_node_stream, import_promises4, LOCAL_MODELS, commands, packageFor;
var init_environment = __esm({
  "src/transcription/environment.ts"() {
    "use strict";
    import_node_fs = require("node:fs");
    import_promises3 = require("node:fs/promises");
    import_node_os2 = require("node:os");
    import_node_path3 = require("node:path");
    import_node_crypto3 = require("node:crypto");
    import_node_stream = require("node:stream");
    import_promises4 = require("node:stream/promises");
    init_errors();
    init_auth();
    init_process();
    LOCAL_MODELS = {
      small: { bytes: 487601967, sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b" },
      medium: { bytes: 1533763059, sha256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208" }
    };
    commands = { ytDlp: "yt-dlp", ffmpeg: "ffmpeg", ffprobe: "ffprobe", whisperCli: "whisper-cli" };
    packageFor = (tool) => tool === "ytDlp" ? "yt-dlp" : tool === "whisperCli" ? "whisper.cpp" : "ffmpeg";
  }
});

// src/transcription/local.ts
var local_exports = {};
__export(local_exports, {
  transcribeLocally: () => transcribeLocally
});
function cancelled(signal) {
  if (signal?.aborted) throw new SummarizeError(499, "ASR_CANCELLED", "Local transcription cancelled");
}
async function withLock(directory, work) {
  await (0, import_promises5.mkdir)(directory, { recursive: true, mode: 448 });
  const path = (0, import_node_path4.join)(directory, ".lock");
  for (let attempt = 0; ; attempt++) {
    try {
      const file = await (0, import_promises5.open)(path, "wx", 384);
      await file.writeFile(String(process.pid));
      await file.close();
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const pid = Number(await (0, import_promises5.readFile)(path, "utf8").catch(() => "0"));
      let live = true;
      try {
        if (!Number.isInteger(pid) || pid <= 0) live = Date.now() - (await (0, import_promises5.stat)(path)).mtimeMs < 6e4;
        else process.kill(pid, 0);
      } catch (error2) {
        live = error2.code === "EPERM";
      }
      if (live || attempt) throw new SummarizeError(409, "ASR_BUSY", "This transcription stage is already running; retry after it finishes");
      await (0, import_promises5.rm)(path, { force: true });
    }
  }
  try {
    return await work();
  } finally {
    await (0, import_promises5.rm)(path, { force: true });
  }
}
function parseSegments(raw, duration) {
  const value = raw;
  if (!Array.isArray(value?.transcription)) throw invalidTranscript();
  const items = [];
  let previous = -1;
  for (const segment of value.transcription) {
    const start = segment?.offsets?.from / 1e3, end = segment?.offsets?.to / 1e3;
    if (typeof segment?.text !== "string" || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start < previous || end < start || end > duration + 1) throw invalidTranscript();
    previous = start;
    const text = segment.text.trim();
    if (text) items.push({ index: items.length, s: start, e: end, text });
  }
  if (!items.length || !items.some((item) => /[\p{L}\p{N}]/u.test(item.text))) throw invalidTranscript();
  return { items, language: typeof value.result?.language === "string" ? value.result.language : void 0 };
}
async function transcribeLocally(input, original, subtitles, options) {
  const signal = input.options?.signal ?? options.signal;
  cancelled(signal);
  const doctor = await doctorLocalTranscription({ ...options, signal });
  if (!doctor.ready) throw new SummarizeError(400, doctor.model.status === "invalid" ? "ASR_MODEL_INVALID" : "ASR_DEPENDENCIES_MISSING", "Local transcription is not ready; run asr doctor, review missing items, then choose whether to run asr setup");
  const config = doctor.config, tools = config.tools, video = input.video;
  const page = Number(video.pageNumber ?? 1);
  if (!Number.isInteger(page) || page < 1 || !(video.source === "bilibili" ? /^(BV[a-zA-Z0-9]{10}|av\d+)$/.test(video.videoId) : /^[a-zA-Z0-9_-]{11}$/.test(video.videoId))) throw invalidAudio();
  const progress = options.onProgress;
  const stage = async (name, work) => {
    cancelled(signal);
    progress?.({ stage: name, status: "started" });
    const start = Date.now();
    const result = await work();
    cancelled(signal);
    progress?.({ stage: name, status: "complete", seconds: (Date.now() - start) / 1e3 });
    return result;
  };
  const mediaDir = (0, import_node_path4.join)(config.cacheDir, "audio", video.source, `${video.videoId}-p${page}`);
  const audio = await withLock(mediaDir, async () => {
    const marker = (0, import_node_path4.join)(mediaDir, "complete.json");
    try {
      const value = JSON.parse(await (0, import_promises5.readFile)(marker, "utf8"));
      if (value.version !== 1 || !/^audio\.[a-zA-Z0-9]+$/.test(value.file) || !Number.isFinite(value.duration) || value.duration <= 0) throw invalidAudio();
      const path = (0, import_node_path4.join)(mediaDir, value.file);
      if ((await (0, import_promises5.stat)(path)).size !== value.bytes || await sha256File(path) !== value.sha256 || original.media?.cid && value.cid !== original.media.cid || original.media?.durationSeconds && Math.abs(value.duration - original.media.durationSeconds) > Math.max(3, original.media.durationSeconds * 0.01)) throw invalidAudio();
      progress?.({ stage: "download-audio", status: "cached" });
      return value;
    } catch {
      await (0, import_promises5.rm)(marker, { force: true });
    }
    for (const entry of await (0, import_promises5.readdir)(mediaDir)) if (entry.startsWith(".download-")) await (0, import_promises5.rm)((0, import_node_path4.join)(mediaDir, entry), { recursive: true, force: true });
    const temp = (0, import_node_path4.join)(mediaDir, `.download-${(0, import_node_crypto4.randomUUID)()}`);
    await (0, import_promises5.mkdir)(temp, { mode: 448 });
    const cookie = (0, import_node_path4.join)(temp, "cookies.txt");
    try {
      return await stage("download-audio", async () => {
        const url = video.source === "bilibili" ? `https://www.bilibili.com/video/${video.videoId}/?p=${page}` : `https://www.youtube.com/watch?v=${video.videoId}`;
        const args = ["--ignore-config", "--no-playlist", "--retries", "1", "--socket-timeout", "30", "-f", "bestaudio", "--write-info-json", "-o", (0, import_node_path4.join)(temp, "audio.%(ext)s")];
        const token = subtitles.bilibiliSessionTokens[0];
        if (video.source === "bilibili" && token) {
          if (/[\r\n\t]/.test(token)) throw new SummarizeError(400, "ASR_CONFIG_INVALID", "Invalid Bilibili session value");
          await (0, import_promises5.writeFile)(cookie, `# Netscape HTTP Cookie File
.bilibili.com	TRUE	/	TRUE	0	SESSDATA	${token}
`, { mode: 384, flag: "wx" });
          args.push("--cookies", cookie);
        }
        await runTool(tools.ytDlp, [...args, "--", url], "download-audio", signal, 6e5);
        const info = JSON.parse(await (0, import_promises5.readFile)((0, import_node_path4.join)(temp, "audio.info.json"), "utf8"));
        if (!info.ext || !/^[a-zA-Z0-9]+$/.test(info.ext)) throw invalidAudio();
        await (0, import_promises5.rm)((0, import_node_path4.join)(temp, "audio.info.json"));
        const file = `audio.${info.ext}`, path = (0, import_node_path4.join)(temp, file);
        const duration = Number((await runTool(tools.ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path], "probe-audio", signal)).trim());
        const expected = original.media?.durationSeconds ?? info.duration;
        if (!Number.isFinite(duration) || duration <= 0 || expected !== void 0 && Math.abs(duration - expected) > Math.max(3, expected * 0.01)) throw invalidAudio();
        const value = { version: 1, file, bytes: (await (0, import_promises5.stat)(path)).size, sha256: await sha256File(path), duration, title: original.title || info.title || video.videoId, cid: original.media?.cid };
        if (!value.bytes) throw invalidAudio();
        cancelled(signal);
        await (0, import_promises5.rename)(path, (0, import_node_path4.join)(mediaDir, file));
        await privateJson(marker, value);
        return value;
      });
    } finally {
      await (0, import_promises5.rm)(temp, { recursive: true, force: true });
    }
  });
  const asrDir = (0, import_node_path4.join)(config.cacheDir, "transcripts", fingerprint({ engine: "whisper.cpp-v1", audio: audio.sha256, model: doctor.model.sha256, language: config.language }));
  const parsed = await withLock(asrDir, async () => {
    const marker = (0, import_node_path4.join)(asrDir, "complete.json");
    try {
      const value = JSON.parse(await (0, import_promises5.readFile)(marker, "utf8"));
      for (const ext of ["json", "srt", "txt"]) if (await sha256File((0, import_node_path4.join)(asrDir, `whisper.${ext}`)) !== value.artifacts[ext]) throw invalidTranscript();
      const result = parseSegments(JSON.parse(await (0, import_promises5.readFile)((0, import_node_path4.join)(asrDir, "whisper.json"), "utf8")), audio.duration);
      progress?.({ stage: "transcribe", status: "cached" });
      return result;
    } catch {
      await (0, import_promises5.rm)(marker, { force: true });
    }
    for (const entry of await (0, import_promises5.readdir)(asrDir)) if (entry.startsWith(".stage-")) await (0, import_promises5.rm)((0, import_node_path4.join)(asrDir, entry), { recursive: true, force: true });
    const temp = (0, import_node_path4.join)(asrDir, `.stage-${(0, import_node_crypto4.randomUUID)()}`);
    await (0, import_promises5.mkdir)(temp, { mode: 448 });
    try {
      const wav = (0, import_node_path4.join)(temp, "audio.wav"), prefix = (0, import_node_path4.join)(temp, "whisper");
      await stage("normalize-audio", () => runTool(tools.ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-i", (0, import_node_path4.join)(mediaDir, audio.file), "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], "normalize-audio", signal, 6e5));
      return await stage("transcribe", async () => {
        await runTool(tools.whisperCli, ["-m", config.modelPath, "-f", wav, "-l", config.language, "-oj", "-osrt", "-otxt", "-of", prefix], "transcribe", signal, 72e5);
        const result = parseSegments(JSON.parse(await (0, import_promises5.readFile)(`${prefix}.json`, "utf8")), audio.duration);
        const artifacts = {};
        for (const ext of ["json", "srt", "txt"]) {
          if (!(await (0, import_promises5.stat)(`${prefix}.${ext}`)).size) throw invalidTranscript();
          artifacts[ext] = await sha256File(`${prefix}.${ext}`);
        }
        cancelled(signal);
        for (const ext of ["json", "srt", "txt"]) await (0, import_promises5.rename)(`${prefix}.${ext}`, (0, import_node_path4.join)(asrDir, `whisper.${ext}`));
        await privateJson(marker, { version: 1, engine: "whisper.cpp", model: (0, import_node_path4.basename)(config.modelPath), modelSha256: doctor.model.sha256, requestedLanguage: config.language, detectedLanguage: result.language, audioDurationSeconds: audio.duration, audioSha256: audio.sha256, artifacts });
        return result;
      });
    } finally {
      await (0, import_promises5.rm)(temp, { recursive: true, force: true });
    }
  });
  cancelled(signal);
  const items = parsed.items.map((item) => ({ ...item, text: input.options?.showTimestamp ? `${item.s} - ${item.text}` : item.text }));
  return {
    ...original,
    title: audio.title,
    subtitlesArray: items,
    transcriptText: items.map((item) => item.text).join(" "),
    usedDescription: false,
    transcription: { engine: "whisper.cpp", model: (0, import_node_path4.basename)(config.modelPath), modelSha256: doctor.model.sha256, requestedLanguage: config.language, detectedLanguage: parsed.language, audioDurationSeconds: audio.duration, audioSha256: audio.sha256, source: { ...video, ...video.source === "bilibili" ? { pageNumber: page } : {} }, artifacts: { json: (0, import_node_path4.join)(asrDir, "whisper.json"), srt: (0, import_node_path4.join)(asrDir, "whisper.srt"), text: (0, import_node_path4.join)(asrDir, "whisper.txt") } }
  };
}
var import_promises5, import_node_path4, import_node_crypto4, invalidAudio, invalidTranscript;
var init_local = __esm({
  "src/transcription/local.ts"() {
    "use strict";
    import_promises5 = require("node:fs/promises");
    import_node_path4 = require("node:path");
    import_node_crypto4 = require("node:crypto");
    init_errors();
    init_auth();
    init_environment();
    init_process();
    invalidAudio = () => new SummarizeError(502, "ASR_INVALID_AUDIO", "Downloaded audio does not match the selected video or page");
    invalidTranscript = () => new SummarizeError(502, "ASR_INVALID_TRANSCRIPT", "Empty or invalid local transcript; no successful result saved");
  }
});

// src/agent/cli.ts
var import_node_util = require("node:util");
var import_promises6 = require("node:fs/promises");
var import_node_path5 = require("node:path");
var import_promises7 = require("node:timers/promises");
init_auth();

// src/agent/prepare.ts
var import_promises2 = require("node:fs/promises");
var import_node_path2 = require("node:path");
var import_node_crypto2 = require("node:crypto");

// src/utils/tokens.ts
function isWideCodePoint(codePoint) {
  return codePoint >= 11904 && codePoint <= 40959 || // CJK radicals … unified ideographs
  codePoint >= 44032 && codePoint <= 55203 || // Hangul syllables
  codePoint >= 63744 && codePoint <= 64255 || // CJK compatibility ideographs
  codePoint >= 65280 && codePoint <= 65519 || // full-width forms
  codePoint >= 131072 && codePoint <= 196607;
}
function estimateTokens(text) {
  if (!text) {
    return 0;
  }
  let wide = 0;
  let narrow = 0;
  for (const char of text) {
    if (isWideCodePoint(char.codePointAt(0) ?? 0)) {
      wide += 1;
    } else {
      narrow += 1;
    }
  }
  return Math.ceil(wide + narrow / 4);
}

// src/summarize/missing-transcript.ts
var DEFAULT_MIN_TRANSCRIPT_TOKENS = 40;
function isMissingTranscript(transcript, minTranscriptTokens = DEFAULT_MIN_TRANSCRIPT_TOKENS) {
  if (transcript.usedDescription) {
    return true;
  }
  if (!(minTranscriptTokens > 0)) {
    return false;
  }
  return estimateTokens(transcript.transcriptText) < minTranscriptTokens;
}

// src/agent/prepare.ts
function parseVideo(value, source) {
  let id = value;
  let page;
  if (/^https?:/.test(value)) {
    const url = new URL(value);
    if (/(^|\.)bilibili\.com$/.test(url.hostname)) {
      id = url.pathname.match(/^\/video\/(BV[a-zA-Z0-9]+|av\d+)\/?$/)?.[1] ?? "";
      source = "bilibili";
      if (url.searchParams.has("p")) page = Number(url.searchParams.get("p"));
    } else if (url.hostname === "youtu.be") {
      id = url.pathname.slice(1);
      source = "youtube";
    } else if (/(^|\.)youtube\.com$/.test(url.hostname)) {
      id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] ?? "";
      source = "youtube";
    } else throw new Error("UNSUPPORTED_URL: use a canonical Bilibili or YouTube video URL");
  }
  source ??= /^(BV|av)/.test(id) ? "bilibili" : "youtube";
  if (source !== "bilibili" && source !== "youtube") throw new Error("INVALID_SOURCE");
  if (!(source === "bilibili" ? /^(BV[a-zA-Z0-9]{10}|av\d+)$/.test(id) : /^[a-zA-Z0-9_-]{11}$/.test(id))) {
    throw new Error("INVALID_VIDEO_ID");
  }
  if (page !== void 0 && (!Number.isInteger(page) || page < 1)) throw new Error("INVALID_PAGE");
  return { source, videoId: id, ...page === void 0 ? {} : { pageNumber: page } };
}
async function localTranscript(path, title) {
  const text = await (0, import_promises2.readFile)(path, "utf8");
  if (path.endsWith(".json")) {
    const result = JSON.parse(text);
    if (typeof result.usedDescription !== "boolean" || typeof result.transcriptText !== "string" || typeof result.title !== "string" || !("subtitlesArray" in result)) {
      throw new Error("INVALID_TRANSCRIPT: expected fetchTranscript() JSON");
    }
    return result;
  }
  const subtitlesArray = text.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    const match = /^(?:\[(\d+(?::\d+){0,2}(?:\.\d+)?)\]\s*|(?=(\d+(?:\.\d+)?)\s+-))/.exec(line);
    const raw = match?.[1] ?? match?.[2];
    const seconds = raw?.split(":").reduce((total, n) => total * 60 + Number(n), 0);
    return { index, text: line, ...seconds === void 0 ? {} : { s: seconds } };
  });
  return {
    title: title ?? "\u7528\u6237\u63D0\u4F9B\u7684\u8F6C\u5F55",
    source: "bilibili",
    videoId: "local",
    usedDescription: false,
    transcriptText: text,
    subtitlesArray
  };
}
async function prepareArtifacts(transcript, out, budget, provenance) {
  if (!Number.isInteger(budget) || budget < 128 || budget > 16e3) throw new Error("INVALID_CHUNK_BUDGET: use 128..16000");
  if (isMissingTranscript(transcript)) throw new Error("NO_TRANSCRIPT: captions absent or too thin; provide a transcript, not a description");
  const original = transcript.subtitlesArray?.length ? transcript.subtitlesArray : [{ index: 0, text: transcript.transcriptText }];
  const items = [];
  for (const item of original.slice().sort((a, b) => a.index - b.index)) {
    if (typeof item.text !== "string") throw new Error("INVALID_SUBTITLE");
    const chars = Array.from(item.text);
    const size = Math.floor(budget / 2);
    for (let start = 0; start < chars.length; start += size) {
      const seconds = item.s === void 0 ? void 0 : Number(item.s);
      if (seconds !== void 0 && (!Number.isFinite(seconds) || seconds < 0)) throw new Error("INVALID_TIMESTAMP");
      items.push({
        index: items.length,
        text: chars.slice(start, start + size).join(""),
        ...seconds === void 0 ? {} : { s: seconds },
        ...item.e === void 0 ? {} : { e: item.e }
      });
    }
  }
  const chunks = [];
  let pending = [];
  const encodedTokens = (group) => estimateTokens(JSON.stringify({ id: "00000000", items: group }, null, 2));
  const flush = () => {
    if (pending.length) chunks.push({
      items: pending,
      text: pending.map((item) => item.text).join(" "),
      startIndex: pending[0].index,
      endIndex: pending[pending.length - 1].index
    });
    pending = [];
  };
  for (const item of items) {
    if (encodedTokens([...pending, item]) > budget) flush();
    if (encodedTokens([item]) > budget) throw new Error("CHUNK_BUDGET_TOO_SMALL: increase --chunk-tokens");
    pending.push(item);
  }
  flush();
  if (!chunks.length) throw new Error("NO_TRANSCRIPT");
  const directory = (0, import_node_path2.resolve)(out);
  await (0, import_promises2.mkdir)(directory, { recursive: false, mode: 448 });
  await (0, import_promises2.mkdir)((0, import_node_path2.join)(directory, "chunks"));
  await (0, import_promises2.mkdir)((0, import_node_path2.join)(directory, "maps"));
  if (transcript.transcription) {
    await (0, import_promises2.mkdir)((0, import_node_path2.join)(directory, "asr"));
    const artifacts = { json: "asr/whisper.json", srt: "asr/whisper.srt", text: "asr/whisper.txt" };
    for (const key of ["json", "srt", "text"]) await (0, import_promises2.copyFile)(transcript.transcription.artifacts[key], (0, import_node_path2.join)(directory, artifacts[key]));
    transcript = { ...transcript, transcription: { ...transcript.transcription, artifacts } };
    provenance = { kind: "local-asr", ...transcript.transcription };
  }
  await (0, import_promises2.writeFile)((0, import_node_path2.join)(directory, "transcript.json"), JSON.stringify(transcript, null, 2));
  const entries = [];
  for (const [i, chunk] of chunks.entries()) {
    const id = String(i + 1).padStart(4, "0");
    const file = `chunks/${id}.json`;
    const value = { id, items: chunk.items };
    const body = JSON.stringify(value, null, 2);
    await (0, import_promises2.writeFile)((0, import_node_path2.join)(directory, file), body);
    entries.push({
      id,
      file,
      mapFile: `maps/${id}.md`,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
      estimatedTextTokens: estimateTokens(chunk.text),
      estimatedFileTokens: estimateTokens(body),
      sha256: (0, import_node_crypto2.createHash)("sha256").update(body).digest("hex")
    });
  }
  const manifest = {
    version: 1,
    title: transcript.title,
    provenance,
    usedDescription: false,
    timestamped: items.every((item) => item.s !== void 0),
    chunkBudget: budget,
    chunkCount: entries.length,
    itemCount: items.length,
    // Bounded source inspection: each entry identifies one file, never embeds text.
    chunks: entries
  };
  await (0, import_promises2.writeFile)((0, import_node_path2.join)(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { manifest: (0, import_node_path2.join)(directory, "manifest.json"), chunkCount: entries.length, usedDescription: false };
}

// src/agent/cli.ts
init_config();

// src/subtitles/bilibili.ts
init_fp();

// src/subtitles/reduce-subtitle-timestamp.ts
function reduceSubtitleTimestamp(subtitles = [], getStart, getText, shouldShowTimestamp) {
  const TOTAL_GROUP_COUNT = 30;
  const MINIMUM_COUNT_ONE_GROUP = 7;
  void (subtitles.length > TOTAL_GROUP_COUNT ? subtitles.length / TOTAL_GROUP_COUNT : MINIMUM_COUNT_ONE_GROUP);
  return subtitles.reduce((accumulator, current, index) => {
    const groupIndex = Math.floor(index / MINIMUM_COUNT_ONE_GROUP);
    if (!accumulator[groupIndex]) {
      accumulator[groupIndex] = {
        index: groupIndex,
        s: getStart(current),
        text: shouldShowTimestamp ? `${getStart(current)} - ` : ""
      };
    }
    const group = accumulator[groupIndex];
    group.text = group.text + getText(current) + " ";
    return accumulator;
  }, []);
}
function reduceYoutubeSubtitleTimestamp(subtitles = []) {
  return reduceSubtitleTimestamp(
    subtitles,
    (i) => i.start,
    (i) => i.lines.join(" "),
    true
  );
}
function reduceBilibiliSubtitleTimestamp(subtitles = [], shouldShowTimestamp) {
  return reduceSubtitleTimestamp(
    subtitles,
    (i) => i.from,
    (i) => i.content,
    shouldShowTimestamp
  );
}

// src/subtitles/bilibili.ts
init_errors();
var MAX_SUBTITLE_ATTEMPTS = 8;
function bilibiliHeaders(ctx, videoId) {
  const sessdata = sample(ctx.config.bilibiliSessionTokens);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": ctx.config.userAgent,
    Host: "api.bilibili.com",
    Cookie: `SESSDATA=${sessdata ?? ""}`,
    Referer: `https://www.bilibili.com/video/${videoId}/`
  };
}
function commonConfig(headers2) {
  return {
    method: "GET",
    cache: "no-cache",
    headers: headers2,
    referrerPolicy: "no-referrer"
  };
}
async function fetchViewInfo(videoId, ctx) {
  const params = videoId.startsWith("av") ? `?aid=${videoId.slice(2)}` : `?bvid=${videoId}`;
  const requestUrl = `https://api.bilibili.com/x/web-interface/view${params}`;
  ctx.logger.debug("fetch", requestUrl);
  const response = await ctx.fetch(requestUrl, commonConfig(bilibiliHeaders(ctx, videoId)));
  if (!response.ok) throw new SummarizeError(response.status, "UPSTREAM", `Bilibili HTTP ${response.status}`);
  const json = await response.json();
  if (json.code !== 0) throw new SummarizeError(502, "UPSTREAM", `Bilibili view code ${json.code}`);
  if (!json.data || typeof json.data !== "object") throw new SummarizeError(502, "CAPTIONS_INVALID", "Invalid Bilibili view response");
  return json.data;
}
async function fetchSubtitleList(aid, cid, videoId, ctx) {
  const requestUrl = `https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${cid}`;
  ctx.logger.debug("fetch", requestUrl);
  const response = await ctx.fetch(requestUrl, commonConfig(bilibiliHeaders(ctx, videoId)));
  if (!response.ok) throw new SummarizeError(response.status, "UPSTREAM", `Bilibili HTTP ${response.status}`);
  const json = await response.json();
  if (json.code !== 0) throw new SummarizeError(502, "UPSTREAM", `Bilibili player code ${json.code}`);
  const list = json?.data?.subtitle?.subtitles;
  if (!Array.isArray(list)) throw new SummarizeError(502, "CAPTIONS_INVALID", "Invalid Bilibili caption list");
  return list;
}
function pickSubtitle(list) {
  return list.find(({ lan }) => lan === "zh-CN") || list[0];
}
function normalizeSubtitleUrl(url) {
  return url?.startsWith("//") ? `https:${url}` : url;
}
async function fetchBilibiliTranscript(videoId, pageNumber, shouldShowTimestamp, ctx) {
  const data = await fetchViewInfo(videoId, ctx);
  const { title = "", desc, dynamic, aid, pages } = data;
  const descriptionText = desc || dynamic ? `${desc ?? ""} ${dynamic ?? ""}`.trim() : void 0;
  const hasPages = (pages?.length ?? 0) > 0;
  if (!hasPages && !pageNumber) {
    return { title, subtitlesArray: null, descriptionText, captionStatus: "unusable" };
  }
  const matchedPage = hasPages ? find(pages ?? [], { page: Number(pageNumber || 1) }) : void 0;
  if (pageNumber != null && !matchedPage) throw new SummarizeError(400, "UPSTREAM", "Bilibili page does not exist");
  const cid = matchedPage?.cid ?? pages?.[0]?.cid;
  if (!aid || !cid) {
    return { title, subtitlesArray: null, descriptionText, captionStatus: "unusable" };
  }
  const duration = matchedPage?.duration ?? data.duration;
  const media = { cid, durationSeconds: duration, pageNumber: Number(pageNumber || 1) };
  let sawCaption = false;
  for (let attempt = 1; attempt <= MAX_SUBTITLE_ATTEMPTS; attempt++) {
    const subtitleList = await fetchSubtitleList(aid, cid, videoId, ctx);
    if (!subtitleList || subtitleList.length < 1) {
      ctx.logger.debug(`empty subtitle list for ${videoId} (attempt ${attempt})`);
      if (!sawCaption) return { title, subtitlesArray: null, descriptionText, captionStatus: "absent", media };
      continue;
    }
    sawCaption = true;
    const betterSubtitle = pickSubtitle(subtitleList);
    const subtitleUrl = normalizeSubtitleUrl(betterSubtitle?.subtitle_url);
    if (!subtitleUrl) {
      continue;
    }
    const subtitleResponse = await ctx.fetch(subtitleUrl, {
      headers: {
        "User-Agent": ctx.config.userAgent,
        Referer: `https://www.bilibili.com/video/${videoId}/`
      }
    });
    if (!subtitleResponse.ok) throw new SummarizeError(subtitleResponse.status, "UPSTREAM", `Bilibili captions HTTP ${subtitleResponse.status}`);
    const subtitles = await subtitleResponse.json();
    const body = subtitles?.body;
    if (!Array.isArray(body) || body.length === 0 || body.some((item) => typeof item.content !== "string" || !Number.isFinite(item.from) || item.from < 0)) {
      continue;
    }
    const lastFrom = Number(body[body.length - 1]?.from ?? 0);
    const tolerance = Math.max(15, (duration ?? 0) * 0.03);
    const matchesDuration = duration == null || Math.abs(lastFrom - duration) <= tolerance;
    const subtitlesArray = reduceBilibiliSubtitleTimestamp(body, shouldShowTimestamp);
    if (matchesDuration) {
      return { title, subtitlesArray, descriptionText, captionStatus: "available", media };
    }
    ctx.logger.warn(
      `bilibili subtitle for ${videoId} looks wrong (ends at ${lastFrom}s, video is ${duration}s); retry ${attempt}/${MAX_SUBTITLE_ATTEMPTS}`
    );
  }
  ctx.logger.warn(`no duration-matched subtitle for ${videoId} after ${MAX_SUBTITLE_ATTEMPTS} attempts`);
  return { title, subtitlesArray: null, descriptionText, captionStatus: sawCaption ? "unusable" : "absent", media };
}

// src/subtitles/youtube.ts
init_fp();
init_errors();
async function fetchYoutubeSubtitleUrls(videoId, ctx) {
  const response = await ctx.fetch(`${ctx.config.savesubsBaseUrl}/action/extract`, {
    method: "POST",
    body: JSON.stringify({
      data: { url: `https://www.youtube.com/watch?v=${videoId}` }
    }),
    headers: {
      "Content-Type": "text/plain",
      "User-Agent": ctx.config.userAgent,
      "X-Auth-Token": ctx.config.savesubsAuthToken ?? "",
      "X-Requested-Domain": "savesubs.com",
      "X-Requested-With": "xmlhttprequest"
    }
  });
  if (!response.ok) throw new SummarizeError(response.status, "UPSTREAM", `YouTube captions HTTP ${response.status}`);
  const { response: json } = await response.json();
  if (!json || !Array.isArray(json.formats)) throw new SummarizeError(502, "CAPTIONS_INVALID", "Invalid YouTube caption list");
  return { title: json.title ?? "", subtitleList: json.formats };
}
async function fetchYoutubeTranscript(videoId, shouldShowTimestamp, ctx) {
  const { title, subtitleList } = await fetchYoutubeSubtitleUrls(videoId, ctx);
  if (!subtitleList || subtitleList.length <= 0) {
    return { title, subtitlesArray: null, captionStatus: "absent" };
  }
  const betterSubtitle = find(subtitleList, { quality: "zh-CN" }) || find(subtitleList, { quality: "English" }) || find(subtitleList, { quality: "English (auto" }) || subtitleList[0];
  if (!betterSubtitle) {
    return { title, subtitlesArray: null, captionStatus: "unusable" };
  }
  if (shouldShowTimestamp) {
    const subtitleUrl2 = `${ctx.config.savesubsBaseUrl}${betterSubtitle.url}?ext=json`;
    const response2 = await ctx.fetch(subtitleUrl2);
    if (!response2.ok) throw new SummarizeError(response2.status, "UPSTREAM", `YouTube captions HTTP ${response2.status}`);
    const subtitles2 = await response2.json();
    if (!Array.isArray(subtitles2) || subtitles2.some((item) => !Array.isArray(item.lines) || item.lines.some((line) => typeof line !== "string") || !Number.isFinite(item.start))) throw new SummarizeError(502, "CAPTIONS_INVALID", "Invalid YouTube captions");
    const subtitlesArray2 = reduceYoutubeSubtitleTimestamp(subtitles2);
    return { title, subtitlesArray: subtitlesArray2, captionStatus: subtitlesArray2.length ? "available" : "unusable" };
  }
  const subtitleUrl = `${ctx.config.savesubsBaseUrl}${betterSubtitle.url}?ext=txt`;
  const response = await ctx.fetch(subtitleUrl);
  if (!response.ok) throw new SummarizeError(response.status, "UPSTREAM", `YouTube captions HTTP ${response.status}`);
  const subtitles = await response.text();
  const subtitlesArray = subtitles.split("\r\n\r\n").filter((text) => text.trim().length > 0).map((text, index) => ({ text, index }));
  return { title, subtitlesArray, captionStatus: subtitlesArray.length ? "available" : "unusable" };
}

// src/subtitles/index.ts
async function fetchTranscript(input, config, ctx) {
  const signal = input.options?.signal;
  const originalFetch = ctx.fetch;
  if (signal) ctx = { ...ctx, fetch: (url, init) => originalFetch(url, { ...init, signal }) };
  const { source, videoId, pageNumber } = input.video;
  const shouldShowTimestamp = input.options?.showTimestamp;
  const result = source === "youtube" ? await fetchYoutubeTranscript(videoId, shouldShowTimestamp, ctx) : await fetchBilibiliTranscript(videoId, pageNumber, shouldShowTimestamp, ctx);
  const { title, subtitlesArray, descriptionText } = result;
  const usedDescription = !subtitlesArray || subtitlesArray.length === 0;
  const transcriptText = usedDescription ? descriptionText ?? "" : subtitlesArray.slice().sort((a, b) => a.index - b.index).map((item) => item.text).join(" ");
  return {
    title,
    videoId,
    source,
    subtitlesArray,
    descriptionText,
    transcriptText,
    usedDescription,
    captionStatus: result.captionStatus,
    media: result.media
  };
}

// src/transcription/fetch.ts
init_errors();
async function fetchTranscriptWithLocal(input, config, ctx, local) {
  if (local && input.video.source === "bilibili") {
    config = { ...config, bilibiliSessionTokens: config.bilibiliSessionTokens.slice(0, 1) };
    ctx = { ...ctx, config };
  }
  const transcript = await fetchTranscript(input, config, ctx);
  if (!local) return transcript;
  if (transcript.captionStatus === "unusable") throw new SummarizeError(502, "CAPTIONS_INVALID", "Platform captions are invalid; local transcription was not started");
  if (transcript.captionStatus !== "absent") return transcript;
  if (input.video.source === "bilibili") {
    const token = config.bilibiliSessionTokens[0];
    if (!token) throw new SummarizeError(401, "UPSTREAM", "Bilibili authentication is required to confirm caption absence");
    const response = await ctx.fetch("https://api.bilibili.com/x/web-interface/nav", { headers: { "User-Agent": config.userAgent, Cookie: `SESSDATA=${token}` }, signal: input.options?.signal });
    if (!response.ok) throw new SummarizeError(response.status, "UPSTREAM", `Bilibili authentication HTTP ${response.status}`);
    const nav = await response.json();
    if (nav.code !== 0 || nav.data?.isLogin !== true) throw new SummarizeError(401, "UPSTREAM", "Bilibili session is invalid; local transcription was not started");
  }
  return (await Promise.resolve().then(() => (init_local(), local_exports))).transcribeLocally(input, transcript, config, local);
}

// src/agent/cli.ts
init_environment();
init_errors();
var help = `video-summarizer source CLI \u2014 Node.js >=22; no LLM API required
  auth login --out <new-private-directory>         Generate login.png and login.json
  auth poll --state <login.json> [--wait]           Check once, or poll for <=180s
  auth import --file <cookie-file|->               Read raw SESSDATA / cookie header / JSON / Netscape
  auth status                                     Verify SESSDATA via Bilibili nav
  prepare --video <URL|BV|av|YouTubeID> --out <new-directory>
  prepare --transcript <txt|json> --out <new-directory> [--title <title>]
  inspect --manifest <manifest.json> [--offset 0] [--limit 20]  Bounded manifest page
  asr doctor                                      Check optional local transcription tools/model
  asr setup                                       Explicitly install missing tools/model only
Options: --auth-file <path>, --chunk-tokens <128..16000; default 3000>,
         --source <bilibili|youtube>, --page <positive integer>,
         --caption-retries <0..3; default 0>  Bounded retries for CAPTIONS_INVALID only
Local ASR: prepare --asr local; --model <small|medium>, --model-path <existing file>,
           --asr-language <auto|Whisper code>, --asr-cache-dir <path>, --asr-config <path>,
           --yt-dlp <path>, --ffmpeg <path>, --ffprobe <path>, --whisper-cli <path>
Auth precedence: BILIBILI_SESSION_TOKEN (one SESSDATA value), then --auth-file,
then ~/.config/video-summarizer/bilibili.json. Import/poll writes the chosen file.
Only manifest path/status is printed. Transcript and chunks are stored on disk.
Existing output directories are rejected. Plain text is assumed to be a transcript;
JSON must have the repository's TranscriptResult shape. Captions are tried first.
ASR is opt-in, runs locally only for explicit caption absence, and never installs.
Setup uses existing Homebrew on macOS; other platforms require manual tools.
Retries stay in the foreground and never reinterpret an error as caption absence.
`;
async function main() {
  const { values, positionals } = (0, import_node_util.parseArgs)({ allowPositionals: true, options: {
    help: { type: "boolean" },
    wait: { type: "boolean" },
    out: { type: "string" },
    state: { type: "string" },
    file: { type: "string" },
    "auth-file": { type: "string" },
    video: { type: "string" },
    transcript: { type: "string" },
    title: { type: "string" },
    "chunk-tokens": { type: "string" },
    source: { type: "string" },
    page: { type: "string" },
    manifest: { type: "string" },
    offset: { type: "string" },
    limit: { type: "string" },
    "caption-retries": { type: "string" },
    asr: { type: "string" },
    model: { type: "string" },
    "model-path": { type: "string" },
    "asr-language": { type: "string" },
    "asr-cache-dir": { type: "string" },
    "asr-config": { type: "string" },
    "yt-dlp": { type: "string" },
    ffmpeg: { type: "string" },
    ffprobe: { type: "string" },
    "whisper-cli": { type: "string" }
  } });
  if (values.help || !positionals.length) {
    console.log(help);
    return;
  }
  const authFile = (0, import_node_path5.resolve)(values["auth-file"] ?? defaultAuthFile());
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  const local = {
    model: values.model,
    modelPath: values["model-path"],
    language: values["asr-language"],
    cacheDir: values["asr-cache-dir"],
    configFile: values["asr-config"],
    signal: controller.signal,
    tools: { ytDlp: values["yt-dlp"], ffmpeg: values.ffmpeg, ffprobe: values.ffprobe, whisperCli: values["whisper-cli"] },
    onProgress: (event) => console.error(JSON.stringify({ progress: event }))
  };
  const required = (name) => {
    const value = values[name];
    if (!value) throw new Error(`MISSING_OPTION: --${name}`);
    return value;
  };
  let result;
  if (positionals[0] === "asr") {
    if (positionals[1] === "doctor") result = await doctorLocalTranscription(local);
    else if (positionals[1] === "setup") result = await setupLocalTranscription(local);
    else throw new Error("UNKNOWN_ASR_COMMAND");
  } else if (positionals[0] === "auth") {
    switch (positionals[1]) {
      case "login":
        result = await startLogin((0, import_node_path5.resolve)(required("out")));
        break;
      case "status":
        result = await checkSession(await readSession(authFile));
        break;
      case "import": {
        const file = required("file");
        const input = file === "-" ? await new Promise((done, reject) => {
          let text = "";
          process.stdin.setEncoding("utf8");
          process.stdin.on("data", (chunk) => {
            text += chunk;
          });
          process.stdin.on("end", () => done(text));
          process.stdin.on("error", reject);
        }) : await (0, import_promises6.readFile)(file, "utf8");
        result = await importSession(input, authFile);
        break;
      }
      case "poll": {
        const deadline = Date.now() + 18e4;
        do {
          result = await pollLogin((0, import_node_path5.resolve)(required("state")), authFile);
          if (!values.wait || result.state === "authenticated") break;
          await new Promise((done) => setTimeout(done, 3e3));
        } while (Date.now() < deadline);
        if (values.wait && result.state !== "authenticated") throw new Error("QR_TIMEOUT");
        break;
      }
      default:
        throw new Error("UNKNOWN_AUTH_COMMAND");
    }
  } else if (positionals[0] === "inspect") {
    if (!values.manifest) throw new Error("MISSING_OPTION: --manifest");
    const offset = Number(values.offset ?? 0), limit = Number(values.limit ?? 20);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("INVALID_MANIFEST_PAGE");
    const manifest = JSON.parse(await (0, import_promises6.readFile)(values.manifest, "utf8"));
    if (manifest.version !== 1 || !Array.isArray(manifest.chunks)) throw new Error("INVALID_MANIFEST");
    const { chunks, ...metadata } = manifest;
    result = {
      ...metadata,
      offset,
      chunks: chunks.slice(offset, offset + limit),
      nextOffset: offset + limit < chunks.length ? offset + limit : null
    };
  } else if (positionals[0] === "prepare") {
    if (!!values.video === !!values.transcript) throw new Error("PROVIDE_ONE_OF_VIDEO_OR_TRANSCRIPT");
    const out = required("out");
    try {
      await (0, import_promises6.lstat)(out);
      throw new Error("OUTPUT_EXISTS: choose a new output directory");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (values.asr && values.asr !== "local") throw new Error("INVALID_ASR: use local");
    const captionRetries = Number(values["caption-retries"] ?? 0);
    if (!Number.isInteger(captionRetries) || captionRetries < 0 || captionRetries > 3) throw new Error("INVALID_CAPTION_RETRIES: use 0..3");
    let transcript;
    let provenance;
    if (values.transcript) {
      transcript = await localTranscript(values.transcript, values.title);
      provenance = { kind: "provided-transcript", file: (0, import_node_path5.resolve)(values.transcript) };
    } else {
      const video = parseVideo(values.video, values.source);
      if (values.page) {
        const page = Number(values.page);
        if (video.source !== "bilibili" || !Number.isInteger(page) || page < 1) throw new Error("INVALID_PAGE");
        video.pageNumber = page;
      }
      const token = video.source === "bilibili" ? await readSession(authFile) : void 0;
      if (token) await checkSession(token, (url, init) => request(String(url), { ...init, signal: controller.signal }));
      const config = resolveSubtitleConfig({ bilibiliSessionTokens: token ? [token] : [] });
      for (let attempt = 0; ; attempt++) {
        controller.signal.throwIfAborted();
        try {
          transcript = await fetchTranscriptWithLocal({ video, options: { showTimestamp: true, signal: controller.signal } }, config, {
            config,
            fetch: (url, init) => request(String(url), init),
            logger: { debug() {
            }, info() {
            }, warn() {
            }, error() {
            } }
          }, values.asr === "local" ? local : void 0);
          if (transcript.captionStatus === "unusable") throw new SummarizeError(502, "CAPTIONS_INVALID", "Platform captions are invalid; retry or provide a transcript");
          break;
        } catch (error) {
          if (controller.signal.aborted || !(error instanceof SummarizeError) || error.code !== "CAPTIONS_INVALID" || attempt >= captionRetries) throw error;
          console.error(JSON.stringify({ progress: { stage: "caption-retry", attempt: attempt + 1, maxRetries: captionRetries, reason: "CAPTIONS_INVALID" } }));
          await (0, import_promises7.setTimeout)(1e3, void 0, { signal: controller.signal });
        }
      }
      if (transcript.captionStatus === "absent" && !transcript.transcription) {
        const error = new SummarizeError(501, "NO_TRANSCRIPT", "No available platform captions");
        Object.assign(error, { reason: "captions_absent" });
        throw error;
      }
      provenance = transcript.transcription ? { kind: "local-asr", ...transcript.transcription } : { kind: "platform-captions", ...video };
    }
    result = await prepareArtifacts(transcript, out, Number(values["chunk-tokens"] ?? 3e3), provenance);
  } else throw new Error("UNKNOWN_COMMAND");
  console.log(JSON.stringify(result));
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  console.error(JSON.stringify({
    error: error instanceof SummarizeError ? error.code : error instanceof SyntaxError ? "INVALID_JSON" : message,
    ...error instanceof SummarizeError ? { message, reason: error.reason } : {}
  }));
  process.exitCode = 1;
});
