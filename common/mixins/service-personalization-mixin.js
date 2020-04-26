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
const { applyServicePersonalization } = require('./../../lib/service-personalizer');
const { nextTick, parseMethodString, slice } = require('./../../lib/utils');

module.exports = function ServicePersonalizationMixin(TargetModel) {
  log.debug(log.defaultContext(), `Applying service personalization for ${TargetModel.definition.name}`);
  TargetModel.afterRemote('**', function () {

    let args = slice(arguments);
    let ctx = args[0];
    let next = args[args.length - 1];
    // let callCtx = ctx.req.callContext;
    log.debug(ctx, `afterRemote: MethodString: ${ctx.methodString}`);

    ctxInfo = parseMethodString(ctx.methodString);
    
    let data = null;
    if (ctxInfo.isStatic) {
      switch (ctxInfo.methodName) {
        case 'create':
          data = ctx.result;
          break;
        case 'find':
          data = ctx.result;
          break;
        case 'findById':
          data = ctx.result;
          break;
        default:
          log.debug(ctx, `afterRemote: Unhandled: ${ctx.methodString}`);
          data = {}
      }

      let personalizationOptions = {
        isBeforeRemote: false,
        context: ctx
      };

      return applyServicePersonalization(ctxInfo.modelName, data, personalizationOptions, function(err) {
        if(err) {
          next(err);
        }
        else {
          next();
        }
      });
    }

    log.debug(ctx, `afterRemote: Unhandled non-static: ${ctx.methodString}`);
    nextTick(next);
  });

  TargetModel.beforeRemote('**', function() {
    let args = slice(arguments);
    let ctx = args[0];
    let next = args[args.length - 1];
    // let callCtx = ctx.req.callContext;

    log.debug(ctx, `beforeRemote: MethodString: ${ctx.methodString}`);

    ctxInfo = parseMethodString(ctx.methodString);

    if(ctxInfo.isStatic) {
      switch(ctxInfo.methodName) {
        // case 'find':
        //   data = {}
        //   break;
        case 'create':
          data = ctx.req.body;
          break;
        default:
          data = {}
          log.debug(ctx, `beforeRemote: Unhandled ${ctx.methodString}`);
      }

      let personalizationOptions = {
        isBeforeRemote: true,
        context: ctx
      };

      return applyServicePersonalization(ctxInfo.modelName, data, personalizationOptions, function(err){
        next(err);
      });
    }
    
    log.debug(ctx, `beforeRemote: Unhandled non-static ${ctx.methodString}`);
    nextTick(next);
  });
}