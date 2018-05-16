var logger = require('oe-logger');
var log = logger('service-personalizer-index');
var util = require('oe-cloud/lib/common/util');

module.exports = function (app) {
  var v = util.checkDependency(app, 'oe-personalization');
  if (!v) {
    log.error('OE Service Personalization - ERROR - Required Dependency on oe-personalization missing.');
    return new Error('OE Service Personalization - ERROR - Required Dependency on oe-personalization missing.');
  }
};
