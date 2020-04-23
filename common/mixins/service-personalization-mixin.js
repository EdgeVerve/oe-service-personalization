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

const ALLOWED_METHOD = ['create', 'find', 'fineOne'];

const parseMethodString = str => {
  return str.split('.').reduce((obj, comp, idx, arr) => {
    let ret = {};
    let length = arr.length;
    if (idx === 0) {
      ret.modelName = comp;
    }
    else if (length === 3 && idx !== length - 1) {
      ret.isStatic = false;
    }
    else if (length === 3 && idx == length - 1) {
      ret.methodName = comp;
    }
    else {
      ret.isStatic = true;
      ret.methodName = comp;
    }
    return Object.assign({}, obj, ret);
  }, {});
}
const slice = [].slice;
const nextTick = function () {
  let args = slice.call(arguments);
  let cb = args.shift();
  return process.nextTick(() => {
    cb.apply(null, args);
  });
}
module.exports = function ServicePersonalizationMixin(TargetModel) {
  TargetModel.beforeRemote('**', function () {

    let args = slice.call(arguments);
    let ctx = args[0];
    let next = args.slice(-1);
    let callCtx = ctx.req.callContext;
    log.debug(callCtx, `MethodString: ${ctx.methodString}`);

    ctxInfo = parseMethodString(ctx.methodString);
    if (ALLOWED_METHOD.includes(ctxInfo.methodName)) {
      let data = null;
      if (ctxInfo.isStatic) {
        switch (ctxInfo.methodName) {
          case 'create':
            data = ctx.instance
            break;
          default:
            log.debug(callCtx, `Unhandled: ${ctx.methodString}`);
            data = {}
        }

        let personalizationOptions = {
          reverse: true,
          context: callCtx
        };

        return applyServicePersonalization(ctxInfo.modelName, data, personalizationOptions, function(err, personalizedData) {
          if(err) {
            next(err);
          }
          else {
            next();
          }
        });
      }
    }

    nextTick(next);
  });
}