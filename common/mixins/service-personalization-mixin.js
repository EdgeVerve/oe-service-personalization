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

const getRelationInfo = (parentModel, { methodName }) => {
  const idx =  7; //__get__
  const REL_GET_STR = '__get__';
  if(methodName.substr(0,idx) === REL_GET_STR) {
    let relName = methodName.substr(idx);
    relationDef = parentModel.settings.relations[relName];
    return { isRelation: true, model: relationDef.model };
  }
  
  return { isRelation: false }
};

module.exports = function ServicePersonalizationMixin(TargetModel) {
  log.debug(log.defaultContext(), `Applying service personalization for ${TargetModel.definition.name}`);
  const TARGET_MODEL_NAME = TargetModel.definition.name;
  TargetModel.afterRemote('**', function ServicePersonalizationAfterRemoteHook() {
    let args = slice(arguments);
    let ctx = args[0];
    let next = args[args.length - 1];
    // let callCtx = ctx.req.callContext;
    log.debug(ctx, `afterRemote: MethodString: ${ctx.methodString}`);

    let ctxInfo = parseMethodString(ctx.methodString);

    let data = null;
    let applyFlag = true;
    let toModel = TARGET_MODEL_NAME;
    if (ctxInfo.isStatic) {
      switch (ctxInfo.methodName) {
        case 'create':
        case 'patchOrCreate':
        case 'find':
        case 'findById':
        case 'findOne':
          data = ctx.result;
          break;
        default:
          log.debug(ctx, `afterRemote: Unhandled static - ${ctx.methodString}`);
          data = {};
          applyFlag = false;
      }
    } else {
      switch (ctxInfo.methodName) {
        case 'patchAttributes':
          data = ctx.result;
          break;
        default:
          let relationInfo = getRelationInfo(TargetModel, ctxInfo);
          if(relationInfo.isRelation) {
            applyFlag = true;
            toModel = relationInfo.model;
            data = ctx.result;
          }
          else {
            applyFlag = false;
            log.debug(ctx, `afterRemote: Unhandled non-static - ${ctx.methodString}`);
          }
      }
    }

    if (applyFlag) {
      let personalizationOptions = {
        isBeforeRemote: false,
        context: ctx
      };

      applyServicePersonalization(toModel, data, personalizationOptions, function (err) {
        if (err) {
          next(err);
        } else {
          next();
        }
      });
    } else {
      nextTick(next);
    }
  });

  TargetModel.beforeRemote('**', function ServicePersonalizationBeforeRemoteHook() {
    let args = slice(arguments);
    let ctx = args[0];
    let next = args[args.length - 1];

    log.debug(ctx, `beforeRemote: MethodString: ${ctx.methodString}`);

    let ctxInfo = parseMethodString(ctx.methodString);
    let applyFlag = true;
    let data = null;
    let toModel = TARGET_MODEL_NAME;

    if (ctxInfo.isStatic) {
      switch (ctxInfo.methodName) {
        case 'create':
        case 'patchOrCreate':
          data = ctx.req.body;
          break;
        case 'find':
        case 'findById':
        case 'findOne':
          data = {};
          break;
        default:
          data = {};
          log.debug(ctx, `beforeRemote: Unhandled static: ${ctx.methodString}`);
          applyFlag = false;
      }
    } else {
      switch (ctxInfo.methodName) {
        case 'patchAttributes':
          data = ctx.req.body;
          break;
        default:
          let relationInfo = getRelationInfo(TargetModel, ctxInfo);
          if(relationInfo.isRelation) {
            applyFlag = true;
            toModel = relationInfo.model;
            data = {};
          }
          else {
            applyFlag = false;
            log.debug(ctx, `beforeRemote: Unhandled non-static - ${ctx.methodString}`);            
          }
      }
    }

    if (applyFlag) {
      let personalizationOptions = {
        isBeforeRemote: true,
        context: ctx
      };

      applyServicePersonalization(toModel, data, personalizationOptions, function (err) {
        next(err);
      });
    } else {
      nextTick(next);
    }
  });
};
