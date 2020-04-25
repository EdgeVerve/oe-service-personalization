/**
 *
 * ©2018-2020 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
/**
 * This boot script brings the ability to apply personalization rules to the model.
 *
 * @memberof Boot Scripts
 * @author deostroll
 * @name Service Personalization
 */
// TODO: without clean db test cases are not passing, need to clean up test cases.

var loopback = require('loopback');
var log = require('oe-logger')('service-personalization');

// var messaging = require('../../lib/common/global-messaging');
var servicePersonalizer = require('../../lib/service-personalizer');

module.exports = function ServicePersonalization(app) {
  servicePersonalizer.init(app);
  let servicePersoConfig = app.get('servicePersonalization');
  servicePersonalizer.loadCustomFunction(require(servicePersoConfig.customFunctionPath));
};

