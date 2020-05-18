const _slice = [].slice;
let { DateTimeFormatter, LocalDateTime, nativeJs } = require('@js-joda/core');
let { Locale } = require('@js-joda/locale');
let { prototype: {toString} } = Object;

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
  }
};
