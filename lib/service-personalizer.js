/**
 *
 * ©2018-2020 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
/**
 * Service personalization module. Optimizes and applies one personalization function.
 *
 * @module oe-service-personalization/lib/service-personalizer
 * @author Atul Pandit, gourav_gupta, pradeep_tippa, arun_jayapal (aka deostroll)
 */

var loopback = require('loopback');
var _ = require('lodash');
var async = require('async');
var exprLang = require('oe-expression/lib/expression-language.js');
var mergeQuery = require('loopback-datasource-juggler/lib/utils').mergeQuery;
var logger = require('oe-logger');
var log = logger('service-personalizer');
var customFunction;
const { nextTick } = require('./utils');

/**
 * This function returns the necessary sorting logic to
 * sort personalization rules. It takes one argument "reverse" which
 * generates the correct sort function to be applied for
 * "fieldReplace" *
 * @param {bool} reverse - flag indicating whether the fieldReplace rule should be reverse applied (i.e applied in the beginning). Default - false.
 * @returns {function} - comparator function to be used for sorting
 */
var sortFactoryFn = (reverse = false) =>
  (first, second) => first.type === 'fieldReplace' ? (reverse ? -1 : 1) : (reverse ? 1 : -1);

// execute custom function
function executeCustomFunction(ctx, instruction, cb) {
  let customFunctionName = instruction.functionName;
  customFunction[customFunctionName](ctx);
  cb();
}

/**
 * Custom function
 */
// getCustom function
function loadCustomFunction(fnCache) {
  customFunction = fnCache;
}

function getCustomFunction() {
  return customFunction;
}


// (Arun 2020-04-28 21:01:57) - retaining the below function for future use

/* To be used when database doesnt support sort OR sort needs to be done in memory*/
// function sortInMemory(ctx, options) {
//   var result = ctx.result;
//   if (typeof result === 'undefined') {
//     return;
//   }
//   if (!Array.isArray(options)) {
//     options = [options];
//   }
//   var keys = [];
//   var values = [];
//   for (var index in options) {
//     if (options.hasOwnProperty(index)) {
//       var key = Object.keys(options[index])[0];
//       values.push(options[index][key]);
//       key = key.indexOf('|') > -1 ? key.replace(/\|/g, '.') : key;
//       keys.push(key);
//     }
//   }
//   var updatedResults;
//   if (Array.isArray(result)) {
//     // lodash version 3.10.1 uses sortByOrder;version 4.0.0 uses OrderBy
//     updatedResults = _.orderBy(result, keys, values);
//   }
//   if (updatedResults) {
//     ctx.result = updatedResults;
//   }
// }

const utils = {

  /**
   * field replacer function
   *
   * @param {instance} record - the model instance or plain data
   * @param {object} replacement - personalization rule (for field name replace)
   * @param {string} value - new field name
   * @returns {void} nothing
   */
  replaceField(record, replacement, value) {
    var pos = replacement.indexOf('\uFF0E');
    var key;
    var elsePart;
    if (pos !== null && pos !== 'undefined' && pos !== -1) {
      key = replacement.substr(0, pos);
      elsePart = replacement.substr(pos + 1);
    } else {
      key = replacement;
    }

    if (record[key] !== 'undefined' && typeof record[key] === 'object') {
      utils.replaceField(record[key], elsePart, value);
    } else if (record[key] !== 'undefined' && typeof record[key] !== 'object') {
      if (record[key]) {
        if (typeof record.__data !== 'undefined') {
          record.__data[value] = record[key];
          delete record.__data[key];
        } else {
          record[value] = record[key];
          delete record[key];
        }
      }
    }
  },

  /**
   * field value replace function
   *
   * @param {instance} record - the model instance or data
   * @param {object} replacement - the personalization rule (for field value replace)
   * @param {string} value - the value to replace
   * @returns {void} nothing
   */
  replaceValue(record, replacement, value) {
    var pos = replacement.indexOf('\uFF0E');
    var key;
    var elsePart;
    if (pos !== null && typeof pos !== 'undefined' && pos !== -1) {
      key = replacement.substr(0, pos);
      elsePart = replacement.substr(pos + 1);
    } else {
      key = replacement;
    }


    if (typeof record[key] !== 'undefined' && Array.isArray(record[key])) {
      var newValue = record[key];
      record[key].forEach(function (element, index) {
        if (value[element]) {
          newValue[index] = value[element];
        }
      });
      if (typeof record.__data !== 'undefined') {
        record.__data[key] = newValue;
      } else {
        record[key] = newValue;
      }
    } else if (typeof record[key] !== 'undefined' && typeof record[key] === 'object') {
      utils.replaceValue(record[key], elsePart, value);
    } else if (typeof record[key] !== 'undefined' && typeof record[key] !== 'object') {
      if (value.hasOwnProperty(record[key])) {
        if (typeof record.__data !== 'undefined') {
          record.__data[key] = value[record[key]];
        } else {
          record[key] = value[record[key]];
        }
      }
    }
  },

  replaceRecordFactory(fn) {
    return function replaceRecord(record, replacements) {
      var keys = Object.keys(JSON.parse(JSON.stringify(replacements)));
      for (var attr in keys) {
        if (keys.hasOwnProperty(attr)) {
          fn(record, keys[attr], replacements[keys[attr]]);
        }
      }
      return record;
    };
  },

  noop() {
    // do nothing
  },

  // === BEGIN: query based filter functions ===

  addWhereClause(ctx, instruction, cb) {
    if (typeof instruction === 'string') {
      exprLang(instruction).then(function addWhereClauseInstrResultCb(result) {
        utils.addWheretoCtx(ctx, result.value.where, cb);
      });
    } else {
      utils.addWheretoCtx(ctx, instruction, cb);
    }
  },

  addWheretoCtx(ctx, where, cb) {
    var filter = ctx.args.filter;
    // Shall we directly use mergeQuery util.?
    if (filter) {
      if (typeof filter === 'string') {
        var filterQuery = JSON.parse(filter);
        if (filterQuery && filterQuery.where) {
          // not sure and | or ?. or will give more results, and will give none.
          var newQuery = {
            or: [where, filterQuery.where]
          };
          filter = filterQuery;
          filter.where = newQuery;
        } else {
          filter.where = where;
        }
      } else {
        filter.where = { or: [where, filter.where] };
      }
    } else {
      filter = {};
      filter.where = where;
    }
    ctx.args.filter = filter;
    cb();
  },

  // === END: query based filter functions ===

  // === BEGIN: lbFilter functions ===

  // Processes a filter instruction. filter instruction schema is same like loopback filter schema.
  addLbFilter(ctx, instruction, cb) {
    utils.addLbFilterClause(ctx, instruction, cb);
  },

  /**
   * Function to add filter clause in query.
   */

  addLbFilterClause(ctx, instruction, cb) {
    if (typeof instruction === 'string') {
      exprLang(instruction).then(function addLbFilterInstrResultCb(result) {
        utils.addLbFiltertoCtx(ctx, result.value, cb);
      });
    } else {
      utils.addLbFiltertoCtx(ctx, instruction, cb);
    }
  },

  addLbFiltertoCtx(ctx, filter, cb) {
    ctx.args.filter = ctx.args.filter || {};
    mergeQuery(ctx.args.filter, filter);
    cb();
  },

  // === END: lbFilter functions ===


  createOrderExp(instruction, tempKeys) {
    if (!Array.isArray(instruction)) {
      instruction = [instruction];
    }

    var orderExp = [];

    for (var i = 0; i < instruction.length; i++) {
      var obj = instruction[i];
      var key = Object.keys(obj)[0];
      var val = obj[key];
      key = key.indexOf('|') > -1 ? key.replace(/\|/g, '.') : key;

      var index = tempKeys.length >= 1 ? tempKeys.indexOf(key) : -1;

      switch (val.toUpperCase()) {
        case 'ASC':
        case 'ASCENDING':
        case '':
          val = 'ASC';
          break;
        case 'DESC':
        case 'DESCENDING':
        case 'DSC':
          val = 'DESC';
          break;
        default:
          val = null;
      }
      if (val && index === -1) {
        var value = key + ' ' + val;
        orderExp.push(value);
      }
    }

    return orderExp;
  }
};

const p13nFunctions = {

  /**
   * Does field replace.
   *
   * PreApplication: Yes
   * PostApplication: Yes
   *
   * For pre-appilication a reverse rule is applied.
   * @param {object} replacements
   * @param {boolean} isBeforeRemote
   */
  // eslint-disable-next-line no-inline-comments
  fieldReplace(replacements, isBeforeRemote = false) { // Tests: t1, t15, t17
    let replaceRecord = utils.replaceRecordFactory(utils.replaceField);

    let process = function (replacements, data, cb) {
      if (Array.isArray(data)) {
        let updatedResult = data.map(record => {
          return replaceRecord(record, replacements);
        });
        data = updatedResult;
      } else {
        data = replaceRecord(data, replacements);
      }

      nextTick(cb);
    };

    if (isBeforeRemote) {
      return function (data, callback) {
        var revInputJson = {};
        var rule = replacements;
        for (var key in rule) {
          if (rule.hasOwnProperty(key)) {
            var pos = key.lastIndexOf('\uFF0E');
            if (pos !== -1) {
              var replaceAttr = key.substr(pos + 1);
              var elsePart = key.substr(0, pos + 1);
              revInputJson[elsePart + rule[key]] = replaceAttr;
            } else {
              revInputJson[rule[key]] = key;
            }
          }
        }
        // fieldReplacementFn(ctx, revInputJson, cb);
        process(revInputJson, data, callback);
      };
    }

    // ! for afterRemote case
    return function (data, callback) {
      process(replacements, data, callback);
    };
  },

  /**
   * does a field value replace.
   *
   * PreApplication: no
   * PostApplication: yes
   *
   * @param {object} replacements - replacement rule
   */
  // eslint-disable-next-line no-inline-comments
  fieldValueReplace(replacements) { // Tests: t22, t20, t19, t18, t17, t16, t3, t23
    return function (data, callback) {
      let replaceRecord = utils.replaceRecordFactory(utils.replaceValue);
      if (Array.isArray(data)) {
        let updatedResult = data.map(record => {
          return replaceRecord(record, replacements);
        });
        data = updatedResult;
      } else {
        data = replaceRecord(data, replacements);
      }

      nextTick(callback);
    };
  },

  noop: function (data, cb) {
    utils.noop(data);
    nextTick(cb);
  },

  /**
   * Apply a sort. Mostly passed on to the Model.find()
   * where the actual sorting is applied. (Provided the
   * underlying datasource supports it)
   *
   * PreApplication: Yes
   * PostApplication: No
   *
   * @param {HttpContext} ctx - the context object
   * @param {object} instruction - the personalization sort rule
   */
  // eslint-disable-next-line no-inline-comments
  addSort(ctx, instruction) { // Tests: t4, t5, t6, t7, t8, t10, t11
    return function (data, callback) {
      utils.noop(data);
      var dsSupportSort = true;
      if (dsSupportSort) {
        var query = ctx.args.filter || {};
        // TODO: (Arun 2020-04-24 19:43:38) - what if no filter?
        if (query) {
          if (typeof query.order === 'string') {
            query.order = [query.order];
          }

          var tempKeys = [];

          if (query.order && query.order.length >= 1) {
            query.order.forEach(function addSortQueryOrderForEachFn(item) {
              tempKeys.push(item.split(' ')[0]);
            });
          }

          // create the order expression based on the instruction passed
          var orderExp = utils.createOrderExp(instruction, tempKeys);

          if (typeof query.order === 'undefined') {
            query.order = orderExp;
          } else {
            query.order = query.order.concat(orderExp);
          }
          query.order = _.uniq(query.order);
          ctx.args.filter = ctx.args.filter || {};
          ctx.args.filter.order = query.order;
          nextTick(callback);
        }
      }

      /**
       * TODO: (Arun 2020-04-24 19:37:19) we may need to enable
       * the below lines if the datasource in consideration is
       * service-oriented, like a web service (for e.g.), and,
       * not a traditional db like mongo or postgres
       */

      // else {
      //   addPostProcessingFunction(ctx, 'sortInMemory', instruction, sortInMemory);
      //   cb();
      // }
    };
  },

  /**
   * Mask helper function for masking a field
   *
   * @param {CallContext} ctx - the request context
   * @param {object} instructions - personalization rule object
   *
   * PreApplication: No
   * PostApplication: Yes
   *
   * Example Rule - Masks a "category field"
   *
        * var rule = {
        *  "modelName": "ProductCatalog",
        *  "personalizationRule" : {
        *    "mask" : {
        *      "category": true
        *    }
        *  }
        * };
   */
  // eslint-disable-next-line no-inline-comments
  mask(ctx, instructions) { // Tests: t13
    return function (data, callback) {
      utils.noop(data);
      let dsSupportMask = true;
      if (dsSupportMask) {
        ctx.args.filter = ctx.args.filter || {};
        let query = ctx.args.filter;
        // TODO: (Arun - 2020-04-24 11:16:19) Don't we need to handle the alternate case?
        // i.e. when there is no filter ?
        if (!query) {
          return nextTick(callback);
        }
        let keys = Object.keys(instructions);
        let exp = {};
        if (typeof query.fields === 'undefined') {
          for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i];
            key = key.indexOf('|') > -1 ? key.replace(/\|/g, '.') : key;
            exp[key] = false;
          }
          query.fields = exp;
        }

        // TODO: (Arun - 2020-04-24 11:17:11) shouldn't we uncomment the following?

        // else {
        //    var fieldList = query.fields;
        //    fieldList = _.filter(fieldList, function (item) {
        //        return keys.indexOf(item) === -1
        //    });
        //    query.fields = fieldList;
        // }
      }

      nextTick(callback);
    };
  },

  /**
   * add a filter to Model.find()
   *
   * PreApplication: yes
   * PostApplication: no
   *
   * @param {HttpContext} ctx - http context
   * @param {object} instruction - personalization filter rule
   */
  // eslint-disable-next-line no-inline-comments
  addFilter(ctx, instruction) {// Tests: t9
    return function (data, callback) {
      utils.noop(data);
      var dsSupportFilter = true;
      if (dsSupportFilter) {
        utils.addWhereClause(ctx, instruction, callback);
      }
    };
  },

  /**
   * Adds a loopback filter clause
   *
   * @param {HttpContext} ctx - context
   * @param {object} instruction - the rule
   */
  // eslint-disable-next-line no-inline-comments
  addLbFilter(ctx, instruction) { // Tests: t21
    return function (data, callback) {
      utils.noop(data);
      utils.addLbFilter(ctx, instruction, callback);
    };
  },

  /**
   * applies masking values in a field. E.g
   * masking first few digits of the phone
   * number
   *
   * @param {object} instruction - mask instructions
   */
  // eslint-disable-next-line no-inline-comments
  addFieldMask(charMaskRules) { // Test t24, t25, t26, t27, t28, t29
    return function (data, callback) {
      var input = data;

      function modifyField(record, property, rule) {
        var pos = property.indexOf('.');
        if (pos !== -1) {
          var key = property.substr(0, pos);
          var innerProp = property.substr(pos + 1);
        } else {
          key = property;
        }

        if (record[key] && typeof record[key] === 'object') {
          modifyField(record[key], innerProp, rule);
        } else if (record[key] && typeof record[key] !== 'object') {
          var char = rule.maskCharacter || 'X';
          var flags = rule.flags;
          var regex = flags ? new RegExp(rule.pattern, flags) : new RegExp(rule.pattern);
          var groups = record[key].match(regex) || [];
          var masking = rule.mask || [];
          var newVal = rule.format || [];
          if (Array.isArray(newVal)) {
            for (let i = 1; i < groups.length; i++) {
              newVal.push('$' + i);
            }
            newVal = newVal.join('');
          }
          masking.forEach(function (elem) {
            newVal = newVal.replace(elem, new Array(groups[elem.substr(1)].length + 1).join(char));
          });
          for (let i = 0; i < groups.length; i++) {
            newVal = newVal.replace('$' + i, groups[i]);
          }
          // normally we set __data but now, lb3!!!
          record[key] = newVal;
        }
      }

      function applyRuleOnRecord(record, charMaskRules) {
        Object.keys(charMaskRules).forEach(function (key) {
          modifyField(record, key, charMaskRules[key]);
        });
        return record;
      }

      if (Array.isArray(input)) {
        var updatedResult = [];
        input.forEach(function (record) {
          updatedResult.push(applyRuleOnRecord(record, charMaskRules));
        });
        input = updatedResult;
      } else {
        input = applyRuleOnRecord(input, charMaskRules);
      }

      // return cb();
      nextTick(callback);
    };
  },


  /**
   * adds the post custom function added via
   * config.json to the after remote
   *
   * PreApplication: no
   * PostApplication: yes
   * @param {context} ctx
   * @param {object} instruction
   * @returns {function} function that applies custom function (async iterator function)
   */
  // eslint-disable-next-line no-inline-comments
  addCustomFunction(ctx, instruction) { // Tests t35, t36
    return function (data, callback) {
      utils.noop(data);
      executeCustomFunction(ctx, instruction, () => nextTick(callback));
    };
  }
};

/**
 * apply the personalization on the given data
 * @param {object} ctx - http context object
 * @param {bool} isBeforeRemote - flag indicating if this is invoked in a beforeRemote stage
 * @param {object} instructions - object containing personalization instructions
 * @param {instance} data - data from the context. Could either be a List or a single model instance
 * @param {function} done - the callback which receives the new data. First argument of function is an error object
 * @returns {void} nothing
 */
function personalize(ctx, isBeforeRemote, instructions, data, done) {
  let tasks = null;
  if (isBeforeRemote) {
    tasks = Object.entries(instructions).map(([operation, instruction]) => {
      switch (operation) {
        case 'mask':
          return { type: 'mask', fn: p13nFunctions.mask(ctx, instruction) };
        case 'sort':
          return { type: 'sort', fn: p13nFunctions.addSort(ctx, instruction) };
        case 'filter':
          return { type: 'filter', fn: p13nFunctions.addFilter(ctx, instruction) };
        case 'fieldReplace':
          return { type: 'fieldReplace', fn: p13nFunctions.fieldReplace(instruction, true) };
        case 'lbFilter':
          return { type: 'lbFilter', fn: p13nFunctions.addLbFilter(ctx, instruction) };
        case 'preCustomFunction':
          return { type: 'preCustomFunction', fn: p13nFunctions.addCustomFunction(ctx, instruction) };
        default:
          return { type: `noop:${operation}`, fn: p13nFunctions.noop };
      }
    });
  } else {
    tasks = Object.entries(instructions).map(([operation, instruction]) => {
      switch (operation) {
        case 'fieldReplace':
          return { type: 'fieldReplace', fn: p13nFunctions.fieldReplace(instruction) };
        case 'fieldValueReplace':
          return { type: 'fieldValueReplace', fn: p13nFunctions.fieldValueReplace(instruction) };
        case 'fieldMask':
          return { type: 'fieldMask', fn: p13nFunctions.addFieldMask(instruction) };
        case 'postCustomFunction':
          return { type: 'postCustomFunction', fn: p13nFunctions.addCustomFunction(ctx, instruction) };
        default:
          return { type: `noop:${operation}`, fn: p13nFunctions.noop };
      }
    });
  }

  let asyncIterator = function ({ type, fn }, done) {
    log.debug(ctx, `${isBeforeRemote ? 'beforeRemote' : 'afterRemote'}: applying function - ${type}`);
    fn(data, function (err) {
      done(err);
    });
  };

  async.eachSeries(tasks.sort(sortFactoryFn(isBeforeRemote)), asyncIterator, function asyncEachCb(err) {
    if (err) {
      done(err);
    } else {
      done();
    }
  });
}


function checkRelationAndRecurse(Model, data, personalizationOptions, done) {
  let { settings: { relations }, definition: { name } } = Model;
  let { isBeforeRemote, context } = personalizationOptions;
  let prefix = isBeforeRemote ? 'beforeRemote' : 'afterRemote';

  if (relations) {
    // Object.entries(Model.setti)
    let relationItems = Object.entries(relations);
    let relationsIterator = function relationProcessor([relationName, relation], done) {
      // check if the related model has personalization
      let relData;
      let relModel = relation.model;
      let applyFlag = false;
      if (Array.isArray(data)) {
        relData = data.reduce((carrier, record) => {
          if (record.__data && typeof record.__data[relationName] !== 'undefined') {
            carrier.push(record.__data[relationName]);
          }
          return carrier;
        }, []);
        relData = _.flatten(relData);
        if (relData.length) {
          applyFlag = true;
        }
      } else if (data.__data) {
        relData = data.__data[relationName];
        applyFlag = !!relData;
      } else if ((relData = data[relationName])) { // eslint-disable-line no-cond-assign
        applyFlag = true;
      }

      let callback = function (err) {
        log.debug(context, `${prefix}: processing relation "${relationName}"/"${name}" - finished`);
        done(err);
      };
      callback.__trace = `${name}_${relationName}`;
      if (applyFlag) {
        log.debug(context, `${prefix}: processing relation "${relationName}"/"${name}"`);
        return applyServicePersonalization(relModel, relData, personalizationOptions, callback);
      }
      log.debug(context, `${prefix}: processing relation "${relationName}"/"${name}" - skipped`);
      nextTick(done);
    };
    return async.eachSeries(relationItems, relationsIterator, done);
  }

  //! no relations
  nextTick(function () {
    done();
  });
}

function applyServicePersonalization(modelName, data, personalizationOptions, done) {
  let { isBeforeRemote, context } = personalizationOptions;
  let findQuery = { where: { modelName, disabled: false } };
  let Model = loopback.findModel(modelName);
  // console.log(Model.definition)
  let callContext = context.req.callContext;
  PersonalizationRule.find(findQuery, callContext, function (err, entries) {
    if (err) {
      done(err);
    } else if (entries.length === 0) {
      //! not needed to personalize here,

      //! however we need to check for related
      //! model
      checkRelationAndRecurse(Model, data, personalizationOptions, function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
    } else {
      //! apply personalization, then check for related model

      personalize(context, isBeforeRemote, entries[0].personalizationRule, data, function (err) {
        if (err) {
          done(err);
        } else {
          checkRelationAndRecurse(Model, data, personalizationOptions, function (err) {
            if (err) {
              done(err);
            } else {
              done();
            }
          });
        }
      });
    }
  });
  // PersonalizationRule.find() - end
}

let PersonalizationRule = null;
/**
 * Initializes this module for service personalization
 * during applcation boot. Initializes observers on
 * PersonalizationRule model.
 *
 * @param {Application} app - The Loopback application object
 */
function init(app) {
  PersonalizationRule = app.models.PersonalizationRule;
  let servicePersoConfig = app.get('servicePersonalization');
  loadCustomFunction(require(servicePersoConfig.customFunctionPath));
  PersonalizationRule.observe('before save', function (ctx, next) {
    log.debug(ctx, 'PersonalizationRule: before save');
    let data = ctx.__data || ctx.instance || ctx.data;

    let model = loopback.findModel(data.modelName);
    if (typeof model === 'undefined') {
      log.error(ctx, `PersonalizationRule: before save - model "${data.modelName}" is not found`);
      return nextTick(function () {
        let error = new Error(`Model: ${data.modelName} is not found`);
        next(error);
      });
    }
    let { personalizationRule: { postCustomFunction } } = data;
    if (postCustomFunction) {
      let { functionName } = postCustomFunction;
      if (functionName) {
        if (!Object.keys(getCustomFunction()).includes(functionName)) {
          return nextTick(function () {
            next(new Error(`The custom function with name "${functionName}" does not exist`));
          });
        }
      } else {
        return nextTick(function () {
          let error = new Error('postCustomFunction not defined with functionName');
          next(error);
        });
      }
    }
    nextTick(next);
  });
}

module.exports = {
  loadCustomFunction,
  getCustomFunction,
  applyServicePersonalization,
  init
};
