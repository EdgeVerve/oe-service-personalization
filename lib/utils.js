const _slice = [].slice;
const { DateTimeFormatter, LocalDateTime, nativeJs } = require('@js-joda/core');
const { Locale } = require('@js-joda/locale');
const { prototype: {toString} } = Object;

const STAR = '*';
const PROTOTYPE = 'prototype';
const DOT = '.';
const DOUBLE_STAR = '**';
const STAR_DOT_STAR = '*.*';
const PROTOTYPE_DOT_STAR = 'prototype.*';

module.exports = {
  /**
   * queue the function to the runtime's next event loop
   *
   * @param {function} cb - the callback function
   * @returns {void}
   */
  nextTick: cb => process.nextTick(cb),

  /**
   * parses a context's methodString
   * @param {string} str - method string
   * @returns {object} - object representing the method string
   */
  parseMethodString: str => {
    return str.split('.').reduce((obj, comp, idx, arr) => {
      let ret = {};
      let length = arr.length;
      if (idx === 0) {
        ret.modelName = comp;
      } else if (length === 3 && idx !== length - 1) {
        ret.isStatic = false;
      } else if (length === 3 && idx === length - 1) {
        ret.methodName = comp;
      } else {
        ret.isStatic = true;
        ret.methodName = comp;
      }
      return Object.assign({}, obj, ret);
    }, {});
  },

  slice: arg => _slice.call(arg),

  createError: msg => new Error(msg),

  /**
   * joda time formatter helper
   * @param {Date} date - the javascript date object to format
   * @param {string} format - joda format string
   * @param {string} locale - as per js-joda/locale api
   * @return {string} - the formatted date
   */
  formatDateTimeJoda(date, format, locale = 'US') {
    let ldt = LocalDateTime.from(nativeJs(date));
    let pattern = DateTimeFormatter.ofPattern(format).withLocale(Locale[locale]);
    return ldt.format(pattern);
  },


  isDate(object) {
    return toString.call(object) === '[object Date]';
  },

  isString(object) {
    return toString.call(object) === '[object String]';
  },

  isObject(object) {
    return toString.call(object) === '[object Object]';
  },

  isNumber(object) {
    return toString.call(object) === '[object Number]';
  },

  /**
   *
   * @param {ModelConstructor} Model - loopback model
   * @param {string} methodName - method name
   * @returns {boolean} - true/false - true if the methodName string is valid
   */
  validateMethodName(Model, methodName) {
    let hasAsterisk = methodName.includes(STAR);
    let hasPrototype = methodName.includes(PROTOTYPE);

    if (hasAsterisk && methodName === STAR) {
      return true;
    } else if (hasAsterisk && methodName === DOUBLE_STAR) {
      return true;
    } else if (hasAsterisk && hasPrototype && (methodName === PROTOTYPE_DOT_STAR || methodName === STAR_DOT_STAR)) {
      return true;
    } else if (!hasPrototype && !hasAsterisk) {
      //! static method
      return !!Model[methodName];
    } else if (hasPrototype && !hasAsterisk) {
      //! prototype method
      let protoMethod = methodName.substr(methodName.indexOf(DOT) + 1);
      return !!Model.prototype[protoMethod];
    }
    return false;
  },

  REMOTES: {
    STAR,
    PROTOTYPE,
    DOT,
    DOUBLE_STAR,
    STAR_DOT_STAR,
    PROTOTYPE_DOT_STAR
  }

};
