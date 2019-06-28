/**
 *
 * ©2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
/**
 * This boot script brings the ability to apply personalization rules to the model.
 *
 * @memberof Boot Scripts
 * @author Pradeep Kumar Tippa
 * @name Service Personalization
 */
// TODO: without clean db test cases are not passing, need to clean up test cases.

var loopback = require('loopback');
var log = require('oe-logger')('service-personalization');

// var messaging = require('../../lib/common/global-messaging');
var servicePersonalizer = require('../../lib/service-personalizer');

var personalizationRuleModel;

module.exports = function ServicePersonalization(app, cb) {
  log.debug(log.defaultContext(), 'In service-personalization.js boot script.');
  personalizationRuleModel = app.models.PersonalizationRule;
  // requiring customFunction
  let servicePersoConfig = app.get('servicePersonalization');
  if ('customFunctionPath' in servicePersoConfig) {
    try {
      servicePersonalizer.loadCustomFunction(require(servicePersoConfig.customFunctionPath));
    } catch(e) {
      console.error(e);
    }
  }
  // Creating 'before save' and 'after save' observer hooks for PersonlizationRule model
  personalizationRuleModel.observe('before save', personalizationRuleBeforeSave);
  personalizationRuleModel.observe('after save', personalizationRuleAfterSave);
  // Creating filter finding only records where disabled is false.
  var filter = {
    where: {
      disabled: false
    }
  };
  // Creating options to fetch all records irrespective of scope.
  var options = {
    ignoreAutoScope: true,
    fetchAllScopes: true
  };
  // Using fetchAllScopes and ignoreAutoScope to retrieve all the records from DB. i.e. from all tenants.
  personalizationRuleModel.find(filter, options, function (err, results) {
    log.debug(log.defaultContext(), 'personalizationRuleModel.find executed.');
    if (err) {
      log.error(log.defaultContext(), 'personalizationRuleModel.find error. Error', err);
      cb(err);
    } else if (results && results.length > 0) {
      // The below code for the if clause will not executed for test cases with clean/empty DB.
      // In order to execute the below code and get code coverage for it we should have
      // some rules defined for some models in the database before running tests for coverage.
      log.debug(log.defaultContext(), 'Some PersonalizationRules are present, on loading of this PersonalizationRule model');
      for (var i = 0; i < results.length; i++) {
        // No need to publish the message to other nodes, since other nodes will attach the hooks on their boot.
        // Attaching all models(PersonalizationRule.modelName) before save hooks when PersonalizationRule loads.
        // Passing directly modelName without checking existence since it is a mandatory field for PersonalizationRule.
        attachRemoteHooksToModel(results[i].modelName, { ctx: results[i]._autoScope });
      }
      cb();
    } else {
      cb();
    }
  });
};

// Subscribing for messages to attach 'before save' hook for modelName model when POST/PUT to PersonalizationRule.
// messaging.subscribe('personalizationRuleAttachHook', function (modelName, options) {
//   // TODO: need to enhance test cases for running in cluster and send/recieve messages in cluster.
//   log.debug(log.defaultContext(), 'Got message to ');
//   attachRemoteHooksToModel(modelName, options);
// });

/**
 * This function is before save hook for PersonlizationRule model.
 *
 * @param {object} ctx - Model context
 * @param {function} next - callback function
 */
function personalizationRuleBeforeSave(ctx, next) {
  var data = ctx.data || ctx.instance;
  // It is good to have if we have a declarative way of validating model existence.
  var modelName = data.modelName;
  if (loopback.findModel(modelName, ctx.options)) {
    var nextFlag = true;
    if (data.personalizationRule.postCustomFunction) {
      if (!(Object.keys(servicePersonalizer.getCustomFunction()).indexOf(data.personalizationRule.postCustomFunction.functionName) > -1) && nextFlag) {
        next(new Error('Module \'' + data.personalizationRule.postCustomFunction.functionName + '\' doesn\'t exists.'));
        nextFlag = false;
      }
    }
    if (data.personalizationRule.preCustomFunction) {
      if (!(Object.keys(servicePersonalizer.getCustomFunction()).indexOf(data.personalizationRule.preCustomFunction.functionName) > -1) && nextFlag) {
        next(new Error('Module \'' + data.personalizationRule.precustomFunction.functionName + '\' doesn\'t exists.'));
      }
    }
    if (nextFlag) {
      next();
    }
  } else {
    // Not sure it is the right way to construct error object to sent in the response.
    var err = new Error('Model \'' + modelName + '\' doesn\'t exists.');
    next(err);
  }
}

/**
 * This function is after save hook for PersonlizationRule model.
 *
 * @param {object} ctx - Model context
 * @param {function} next - callback function
 */
function personalizationRuleAfterSave(ctx, next) {
  log.debug(log.defaultContext(), 'personalizationRuleAfterSave method.');
  var data = ctx.data || ctx.instance;
  // Publishing message to other nodes in cluster to attach the 'before save' hook for model.
  // messaging.publish('personalizationRuleAttachHook', data.modelName, ctx.options);
  log.debug(log.defaultContext(), 'personalizationRuleAfterSave data is present. calling attachBeforeSaveHookToModel');
  attachRemoteHooksToModel(data.modelName, ctx.options);
  next();
}

/**
 * This function is to attach remote hooks for given modelName to apply PersonalizationRule.
 *
 * @param {string} modelName - Model name
 * @param {object} options - options
 */
function attachRemoteHooksToModel(modelName, options) {
  // Can we avoid this step and get the ModelConstructor from context.
  var model = loopback.findModel(modelName, options);
  // Setting the flag that Personalization Rule exists, need to check where it will be used.
  if (!model.settings._personalizationRuleExists) {
    model.settings._personalizationRuleExists = true;
    // We can put hook methods in an array an have single function to attach them.
    // After Remote hooks

    afterRemoteFindHook(model);
    afterRemoteFindByIdHook(model);
    afterRemoteFindOneHook(model);
    afterRemoteCreateHook(model);
    afterRemoteUpsertHook(model);
    afterRemoteUpdateAttributesHook(model);

    // Before Remote Hooks
    beforeRemoteCreateHook(model);
    beforeRemoteUpsertHook(model);
    beforeRemoteUpdateAttributesHook(model);
    beforeRemoteFindHook(model);
    beforeRemoteFindOneHook(model);
    beforeRemoteFindByIdHook(model);
  }
}

/**
 * This function is to attach after remote hook for find for given model.
 *
 * @param {object} model - Model constructor object.
 */
function afterRemoteFindHook(model) {
  model.afterRemote('find', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'afterRemoteFindHook for ', model.modelName, ' called');
    afterRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach after remote hook for findById for given model.
 *
 * @param {object} model - Model constructor object.
 */
function afterRemoteFindByIdHook(model) {
  model.afterRemote('findById', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'afterRemoteFindByIdHook for ', model.modelName, ' called');
    afterRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach after remote hook for findOne for given model.
 *
 * @param {object} model - Model constructor object.
 */
function afterRemoteFindOneHook(model) {
  model.afterRemote('findOne', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'afterRemoteFindOneHook for ', model.modelName, ' called');
    afterRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach after remote hook for create for given model.
 *
 * @param {object} model - Model constructor object.
 */
function afterRemoteCreateHook(model) {
  model.afterRemote('create', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'afterRemoteCreateHook for ', model.modelName, ' called');
    afterRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach after remote hook for upsert for given model.
 *
 * @param {object} model - Model constructor object.
 */
function afterRemoteUpsertHook(model) {
  model.afterRemote('upsert', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'afterRemoteUpsertHook for ', model.modelName, ' called');
    afterRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach after remote hook for updateAttributes for given model.
 *
 * @param {object} model - Model constructor object.
 */
function afterRemoteUpdateAttributesHook(model) {
  model.afterRemote('prototype.updateAttributes', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'afterRemoteUpdateAttributes for ', model.modelName, ' called');
    afterRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach before remote hook for create for given model.
 *
 * @param {object} model - Model constructor object.
 */
function beforeRemoteCreateHook(model) {
  model.beforeRemote('create', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'beforeRemoteCreateHook for ', model.modelName, ' called');
    beforeRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach before remote hook for upsert for given model.
 *
 * @param {object} model - Model constructor object.
 */
function beforeRemoteUpsertHook(model) {
  model.beforeRemote('upsert', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'beforeRemoteUpsertHook for ', model.modelName, ' called');
    beforeRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach before remote hook for updateAttributes for given model.
 *
 * @param {object} model - Model constructor object.
 */
function beforeRemoteUpdateAttributesHook(model) {
  model.beforeRemote('prototype.updateAttributes', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'beforeRemoteUpdateAttributesHook for ', model.modelName, ' called');
    beforeRemotePersonalizationExec(model, ctx, next);
  });
}

/**
 * This function is to attach before remote hook for find for given model
 * and modify ctx.args.filter if any corresponding personalization rule is there.
 *
 * @param {object} model - Model constructor object.
 */
function beforeRemoteFindHook(model) {
  model.beforeRemote('find', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'beforeRemoteFindHook ', model.modelName, 'called');
    servicePersonalizer.getPersonalizationRuleForModel(model.modelName, ctx, function servicePersonalizationAccessHookGetRuleCb(rule) {
      if (rule !== null && typeof rule !== 'undefined') {
        log.debug(ctx.req.callContext, 'beforeRemoteFindHook personalization rule found , rule: ', rule);
        var fns = servicePersonalizer.applyPersonalizationRule(ctx, rule.personalizationRule);
        fns = fns.filter(x => x.type !== 'postCustomFunction');
        fns = fns.map(x => x.fn);
        servicePersonalizer.execute(fns, function (err) {
          if (err) {
            return next(err);
          }
          log.debug(ctx.req.callContext, 'filter', ctx.args.filter);
          next();
        });
      } else {
        log.debug(ctx.req.callContext, 'beforeRemoteFindHook no rules were found');
        next();
      }
    });
  });
}

function beforeRemoteFindOneHook(model) {
  model.beforeRemote('findOne', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'beforeRemoteFindOneHook ', model.modelName, 'called');
    servicePersonalizer.getPersonalizationRuleForModel(model.modelName, ctx, function servicePersonalizationAccessHookGetRuleCb(rule) {
      if (rule !== null && typeof rule !== 'undefined') {
        log.debug(ctx.req.callContext, 'beforeRemoteFindOneHook personalization rule found , rule: ', rule);
        var fns = servicePersonalizer.applyPersonalizationRule(ctx, rule.personalizationRule);
        fns = fns.filter(x => x.type !== 'postCustomFunction');
        fns = fns.map(x => x.fn);
        servicePersonalizer.execute(fns, function (err) {
          if (err) {
            return next(err);
          }
          log.debug(ctx.req.callContext, 'filter', ctx.args.filter);
          next();
        });
      } else {
        log.debug(ctx.req.callContext, 'beforeRemoteFindOneHook no rules were found');
        next();
      }
    });
  });
}

function beforeRemoteFindByIdHook(model) {
  model.beforeRemote('findById', function (ctx, modelInstance, next) {
    log.debug(ctx.req.callContext, 'beforeRemoteFindByIdHook ', model.modelName, 'called');
    servicePersonalizer.getPersonalizationRuleForModel(model.modelName, ctx, function servicePersonalizationAccessHookGetRuleCb(rule) {
      if (rule !== null && typeof rule !== 'undefined') {
        log.debug(ctx.req.callContext, 'beforeRemoteFindByIdHook personalization rule found , rule: ', rule);
        var fns = servicePersonalizer.applyPersonalizationRule(ctx, rule.personalizationRule);
        fns = fns.filter(x => x.type !== 'postCustomFunction');
        fns = fns.map(x => x.fn);
        servicePersonalizer.execute(fns, function (err) {
          if (err) {
            return next(err);
          }
          log.debug(ctx.req.callContext, 'filter', ctx.args.filter);
          next();
        });
      } else {
        log.debug(ctx.req.callContext, 'beforeRemoteFindByIdHook no rules were found');
        next();
      }
    });
  });
}

/**
 * This function is to do the execution personalization rules of after remote hook for given model.
 *
 * @param {object} model - Model constructor object.
 * @param {object} ctx - context object.
 * @param {function} next - callback function.
 */
function afterRemotePersonalizationExec(model, ctx, next) {
  log.debug(ctx.req.callContext, 'afterRemotePersonalizationExec for ', model.modelName, ' called.');
  servicePersonalizer.getPersonalizationRuleForModel(model.modelName, ctx, function servicePersonalizationMixinBeforeCreateGetReverse(rule) {
    if (rule !== null && typeof rule !== 'undefined') {
      log.debug(ctx.req.callContext, 'afterRemotePersonalizationExec personalization rule found , rule: ', rule);
      log.debug(ctx.req.callContext, 'applying PersonalizationRule now');
      log.debug(ctx.req.callContext, 'beforeRemoteFindHook personalization rule found , rule: ', rule);
      var fns = servicePersonalizer.applyPersonalizationRule(ctx, rule.personalizationRule);
      fns = fns.map(x => x.fn);
      servicePersonalizer.execute(fns, function (err) {
        if (err) {
          return next(err);
        }
        log.debug(ctx.req.callContext, 'filter', ctx.args.filter);
        next();
      });
    } else {
      log.debug(ctx.req.callContext, 'afterRemotePersonalizationExec no rules were found');
      next();
    }
  });
}

/**
 * This function is to do the execution personalization rules of before remote hook for given model.
 *
 * @param {object} model - Model constructor object.
 * @param {object} ctx - context object.
 * @param {function} next - callback function.
 */
function beforeRemotePersonalizationExec(model, ctx, next) {
  log.debug(ctx.req.callContext, 'beforeRemotePersonalizationExec for ', model.modelName, ' called.');
  servicePersonalizer.getPersonalizationRuleForModel(model.modelName, ctx, function servicePersonalizationMixinBeforeCreateGetReverse(rule) {
    if (rule !== null && typeof rule !== 'undefined') {
      log.debug(ctx.req.callContext, 'beforeRemotePersonalizationExec personalization rule found , rule: ', rule);
      log.debug(ctx.req.callContext, 'applying PersonalizationRule now');
      var fns = servicePersonalizer.applyReversePersonalizationRule(ctx, rule.personalizationRule);
      servicePersonalizer.execute(fns, function (err) {
        if (err) {
          return next(err);
        }
        log.debug(ctx.req.callContext, 'filter', ctx.args.filter);
        next();
      });
    } else {
      log.debug(ctx.req.callContext, 'beforeRemotePersonalizationExec no rules were found');
      next();
    }
  });
}
