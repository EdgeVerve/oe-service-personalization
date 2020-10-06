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

// var messaging = require('../../lib/common/global-messaging');
var servicePersonalizer = require('../../lib/service-personalizer');

module.exports = function ServicePersonalization(app) {
  servicePersonalizer.init(app);
};

