const _slice = [].slice;
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

  slice: arg => _slice.call(arg)
};
