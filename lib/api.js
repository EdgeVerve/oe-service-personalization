const { performServicePersonalizations, applyServicePersonalization } = require('./service-personalizer');
module.exports = {
  /**
   * Standard api for personalization
   */
  performServicePersonalizations,

  /**
   * Api for personalization. Rules can
   * be manually passed as arguments to
   * this function.
   *
   * @param {string} modelName - the model name.
   * @param {*} data - object or array
   * @param {array} personalizationRecords - the personalization rule as an array.
   * @param {object} options - personalization options
   * @param {function} done - callback to signal completion. Takes only one argument - error.
   * @returns {undefined} - nothing
   */
  applyServicePersonalization: function applyServicePersonalizationWrapper(modelName, data, personalizationRecords, options, done) {
    let { context } = options;
    context._personalizationCache = {};
    applyServicePersonalization(modelName, data, personalizationRecords, options, done);
  }
};
