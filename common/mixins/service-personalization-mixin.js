/**
 *
 * ©2016-2020 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

/**
 * This mixin will attach beforeRemote and afterRemote
 * hooks and decide if the data needs to be service
 * personalized.
 *
 * Therefore, it is necessary to enable the mixin
 * configuration on the corresponding model definition,
 * even if it does not directly participate in the
 * service personalization (viz is the case with any
 * form of relations - or related models).
 *
 * This will only personalize data for the remote endpoints.
 */


const logger = require('oe-logger');
const log = logger('service-personalization-mixin');
const { runPersonalizations } = require('./../../lib/service-personalizer');
const { slice } = require('./../../lib/utils');

module.exports = function ServicePersonalizationMixin(TargetModel) {
  log.debug(log.defaultContext(), `Applying service personalization for ${TargetModel.definition.name}`);
  TargetModel.afterRemote('**', function ServicePersonalizationAfterRemoteHook() {
    let args = slice(arguments);
    let ctx = args[0];
    let next = args[args.length - 1];
    // let callCtx = ctx.req.callContext;
    log.debug(ctx, `afterRemote: (enter) MethodString: ${ctx.methodString}`);
    runPersonalizations(ctx, false, function(err){
      log.debug(ctx, `afterRemote: (leave${err ? '- with error' : ''}) MethodString: ${ctx.methodString}`);
      next(err);
    });
    
  });

  TargetModel.beforeRemote('**', function ServicePersonalizationBeforeRemoteHook() {
    let args = slice(arguments);
    let ctx = args[0];
    let next = args[args.length - 1];

    log.debug(ctx, `beforeRemote: (enter) MethodString: ${ctx.methodString}`);

    // let ctxInfo = parseMethodString(ctx.methodString);
    runPersonalizations(ctx, true, function(err){
      log.debug(ctx, `beforeRemote: (leave${err ? '- with error' : ''}) MethodString: ${ctx.methodString}`);
      next(err);
    });
  });
};
