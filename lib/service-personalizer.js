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

// begin - task-import - import from utils
const {
  nextTick,
  parseMethodString,
  createError,
  formatDateTimeJoda,
  isDate,
  isString,
  isObject,
  isNumber,
  validateMethodName,
  REMOTES
} = require('./utils');
// end - task-import

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


// begin - task-utils - utility functions
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
    if (pos !== -1) {
      key = replacement.substr(0, pos);
      elsePart = replacement.substr(pos + 1);
    } else {
      key = replacement;
    }

    if (typeof record[key] !== 'undefined' && typeof record[key] === 'object') {
      utils.replaceField(record[key], elsePart, value);
    } else if (typeof record[key] !== 'undefined' && typeof record[key] !== 'object') {
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
  },

  getMaskedString(stringRule, value) {
    let { pattern, flags, format, mask, maskCharacter } = stringRule;
    let char = maskCharacter || 'X';
    let rgx = flags ? new RegExp(pattern, flags) : new RegExp(pattern);
    let groups = value.match(rgx);
    let masking = mask || [];
    // eslint-disable-next-line no-inline-comments
    let newVal = format || []; // format can be an array or string
    if (Array.isArray(newVal)) {
      for (let i = 1, len = groups.length; i < len; i++) {
        newVal.push(`$${i}`);
      }
      newVal = newVal.join('');
    }
    masking.forEach(function (elem) {
      newVal = newVal.replace(elem, new Array(groups[elem.substr(1)].length + 1).join(char));
    });
    for (let i = 0; i < groups.length; i++) {
      newVal = newVal.replace('$' + i, groups[i]);
    }
    return newVal;
  },

  getMaskedDate(rule, value) {
    let { format, locale } = rule;
    return formatDateTimeJoda(value, format, locale);
  }
};
// end - task-utils - utility functions

// begin task-p13nFunctions

const p13nFunctions = {

  /**
   * Does field replace.
   *
   * Pre-Fetch: Yes
   * Post-Fetch: Yes
   *
   * For pre-appilication a reverse rule is applied.
   * @param {object} replacements
   * @param {boolean} isBeforeRemote
   */
  // eslint-disable-next-line no-inline-comments
  fieldReplace(replacements, isBeforeRemote = false) { // Tests: t1, t15, t17
    let replaceRecord = utils.replaceRecordFactory(utils.replaceField);

    let execute = function (replacements, data, cb) {
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
        execute(revInputJson, data, callback);
      };
    }

    // ! for afterRemote case
    return function (data, callback) {
      execute(replacements, data, callback);
    };
  },

  /**
   * does a field value replace.
   *
   * Pre-Fetch: no
   * Post-Fetch: yes
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
   * Pre-Fetch: Yes
   * Post-Fetch: No
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
   * Pre-Fetch: No
   * Post-Fetch: Yes
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
   * Pre-Fetch: yes
   * Post-Fetch: no
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

        let oldValue = record[key];

        if (isString(oldValue) && 'stringMask' in rule) {
          record[key] = utils.getMaskedString(rule.stringMask, oldValue);
        } else if (isDate(oldValue) && 'dateMask' in rule) {
          record[`$${key}`] = utils.getMaskedDate(rule.dateMask, oldValue);
        } else if (isObject(oldValue)) {
          modifyField(oldValue, innerProp, rule);
        } else if (isNumber(oldValue) && 'numberMask' in rule) {
          record[`$${key}`] = utils.getMaskedString(rule.numberMask, String(oldValue));
        } else if (isString(oldValue)) {
          record[key] = utils.getMaskedString(rule, oldValue);
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
   * Pre-Fetch: no
   * Post-Fetch: yes
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

// end task-p13nFunctions

/**
 * apply the personalization on the given data
 * @param {object} ctx - http context object
 * @param {bool} isBeforeRemote - flag indicating if this is invoked in a beforeRemote stage
 * @param {object} instructions - object containing personalization instructions
 * @param {*} data - data from the context. Could either be a List or a single model instance
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

/**
 * Checks if the model has relations, and,
 * also determines if data consists of
 * relational data, then recursively personalizes
 * @param {function} Model - loopback model constructor
 * @param {*} data - data to personalize - object or array
 * @param {object} personalizationOptions - standard options passed to applyServicePersonalization()
 * @param {callback} done - to signal completion of task
 * @returns {undefined} - nothing
 */
function checkRelationAndRecurse(Model, data, personalizationOptions, done) {
  let { settings: { relations }, definition: { name } } = Model;
  let { isBeforeRemote, context } = personalizationOptions;
  let prefix = isBeforeRemote ? 'beforeRemote' : 'afterRemote';
  let personalizationCache = context._personalizationCache;
  let rootInfo = personalizationCache && personalizationCache.info;

  if (relations) {
    // Object.entries(Model.setti)
    let relationItems = Object.entries(relations);
    let relationsIterator = function relationProcessor([relationName, relation], done) {
      // check if the related model has personalization
      let relData;
      let relModel = relation.model;
      let applyFlag = false;
      let methodName = rootInfo && rootInfo.methodName;

      // begin - implicitRelationCheck - checking for implicit relation call
      if (rootInfo && !rootInfo.isStatic && methodName.startsWith('__') && methodName.includes(relationName)) {
        //! this is an implicit relation http call
        //    E.g GET /api/Customers/2/Orders
        //    Here data will be that of Order
        //    model.
        relData = data;
        applyFlag = true;
        // end - implicitRelationCheck
      } else if (Array.isArray(data)) {
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
        log.debug(context, `${prefix}: (leave${err ? '- with error' : ''}) processing relation "${name}/${relationName}"`);
        done(err);
      };
      callback.__trace = `${name}_${relationName}`;
      if (applyFlag) {
        log.debug(context, `${prefix}: (enter) processing relation: ${name}/${relationName}`);
        // let { context: { _personalizationCache : { records }} } = personalizationOptions;
        // return applyServicePersonalization(relModel, relData, records, )
        // return applyServicePersonalization(relModel, relData, personalizationOptions, callback);
        return fetchPersonalizationRecords(context, relModel, function (err, relModelP13nRecords) {
          if (err) {
            return callback(err);
          }
          applyServicePersonalization(relModel, relData, relModelP13nRecords, personalizationOptions, callback);
        });
      }
      log.debug(context, `${prefix}: (leave) processing relation "${relationName}"/"${name}" - skipped`);
      nextTick(done);
    };

    return async.eachSeries(relationItems, relationsIterator, done);
  }

  //! no relations
  nextTick(function () {
    done();
  });
}

function fetchPersonalizationRecords(ctx, forModel, cb) {
  let filter = { where: { modelName: forModel, disabled: false } };
  let { req: { callContext } } = ctx;
  PersonalizationRule.find(filter, callContext, cb);
}

/**
 * Iterates properties of the lb model, if it
 * is a model constructor, applies personalization
 * recursively
 *
 * @param {function} Model - the loopback model
 * @param {*} data - the data to personalize - object/array
 * @param {object} options - standard options passed to applyServicePersonalization()
 * @param {callback} cb - signal completion of activity
 * @returns {undefined} - nothing
 */
function checkPropsAndRecurse(Model, data, options, cb) {
  let ctx = options.context;
  let { isBeforeRemote } = options;
  let modelName = Model.definition.name;
  let done = err => {
    log.debug(ctx, `${isBeforeRemote ? 'beforeRemote' : 'afterRemote'}: (leave${err ? '- with error' : ''}) applying personalization on properties of ${modelName}`);
    cb(err);
  };

  let getModelCtorProps = lbModel => {
    let propHash = lbModel.definition.properties;
    let props = Object.entries(propHash);
    let ctorTestPrimitive = ctor => ctor === String || ctor === Number || ctor === Date || ctor === Boolean;
    let unAllowedCtors = ['ObjectID', 'Object'];
    let ctorTestNames = ctor => unAllowedCtors.includes(ctor.name);
    let ctorTest = ctor => ctorTestPrimitive(ctor) || ctorTestNames(ctor);
    let modelProps = props.reduce((carrier, item) => {
      let [fieldName, propDef] = item;
      let { type } = propDef;
      let addFlag = false;
      if (fieldName === 'id') {
        return carrier;
      }
      if (typeof type === 'function' && !ctorTest(type)) {
        addFlag = true;
      } else if (typeof type === 'object' && Array.isArray(type)) {
        addFlag = type.some(ctorFn => !ctorTest(ctorFn));
      }
      if (addFlag) {
        carrier.hasModelCtorProps = true;
        carrier.modelProps.push(item);
      }
      return carrier;
    }, { modelProps: [], hasModelCtorProps: false });
    return modelProps;
  };

  let extractData = (key, data) => {
    if (typeof data === 'object' && Array.isArray(data)) {
      return _.flatten(data.map(item => extractData(key, item)));
    }
    if (data.__data) {
      return data.__data[key];
    }

    return data[key];
  };

  let mInfo = getModelCtorProps(Model);
  if (mInfo.hasModelCtorProps) {
    return async.eachSeries(mInfo.modelProps, function propPersonalizerFn([key, propDef], cb) {
      let { type } = propDef;

      let relations = Model.settings.relations;
      let done = err => {
        log.debug(ctx, `${isBeforeRemote ? 'beforeRemote' : 'afterRemote'}: (leave${err ? '- with error' : ''}) personalizing field ${modelName}/${key}`);
        cb(err);
      };
      log.debug(ctx, `${isBeforeRemote ? 'beforeRemote' : 'afterRemote'}: (enter) personalizing field ${modelName}/${key}`);
      // begin - task01

      // if the property is an embedsOne relation
      //  property, skip the processing

      //! Because they might already be personalized

      let isAnEmbedsOneRelationProp = Object.entries(relations).some(([relationName, relationDef]) => {
        utils.noop(relationName);
        // TODO: Add more checks here...(?)
        return relationDef.type === 'embedsOne' && relationDef.property === key;
      });
      // end - task01


      if (!isAnEmbedsOneRelationProp) {
        let unpersonalizedData = null;
        let modelCtorName = null;

        // begin - task02 - extract data

        if (typeof type === 'function') {
          //! this is a plain model constructor
          modelCtorName = type.name;
          unpersonalizedData = extractData(key, data);
        } else {
          //! this is an array of model constructors

          //! Only one model constructor available(?)
          let modelCtor = type[0];
          modelCtorName = modelCtor.name;
          unpersonalizedData = extractData(key, data);
        // eslint-disable-next-line no-inline-comments
        }// end if-else block - if(typeof type === 'function')

        // end - task02 - extract data

        return fetchPersonalizationRecords(ctx, modelCtorName, function (err, records) {
          if (err) {
            return done(err);
          }
          applyServicePersonalization(modelCtorName, unpersonalizedData, records, options, done);
        });
      // eslint-disable-next-line no-inline-comments
      } // end if-block if(!isAnEmbedsOneRelationProp)

      nextTick(done);
    }, function (err) {
      done(err);
    });
  }
  nextTick(done);
}

/**
 * Personalization helper function.
 *
 * @param {string} modelName - name of the model
 * @param {*} data - the data to personalize - object/array
 * @param {[object]} records - the personalization records
 * @param {object} options - the personalization options
 * @param {callback} cb - to signal completion of task
 * @return {undefined} - nothing
 */
function applyServicePersonalization(modelName, data, records, options, cb) {
  let Model = loopback.findModel(modelName);
  let ctx = options.context;
  let isBeforeRemote = options.isBeforeRemote;
  log.debug(ctx, `${isBeforeRemote ? 'beforeRemote' : 'afterRemote'}: (enter) applying personalization for model: ${modelName}`);
  let done = err => {
    log.debug(ctx, `${isBeforeRemote ? 'beforeRemote' : 'afterRemote'}: (leave${err ? ' - with error' : ''}) applying personalization for model: ${modelName}`);
    cb(err);
  };

  let execute = function ServicePersonalizationExecute(records) {
    if (records.length === 0) {
      checkRelationAndRecurse(Model, data, options, function (err) {
        if (err) {
          return done(err);
        }
        checkPropsAndRecurse(Model, data, options, done);
      });
    } else {
      let entry = records[0];
      let personalizationRule = entry.personalizationRule;
      let ctx = options.context;
      let isBeforeRemote = options.isBeforeRemote;
      personalize(ctx, isBeforeRemote, personalizationRule, data, function (err) {
        if (err) {
          return done(err);
        }
        checkRelationAndRecurse(Model, data, options, function (err) {
          if (err) {
            return done(err);
          }
          checkPropsAndRecurse(Model, data, options, done);
        });
      });
    }
  };

  if (isRemoteMethodAllowed(ctx, records)) {
    return execute(records);
  }
  nextTick(done);
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
  if (servicePersoConfig && servicePersoConfig.customFunctionPath) {
    loadCustomFunction(require(servicePersoConfig.customFunctionPath));
  }
  PersonalizationRule.observe('before save', function PersonalizationRuleBeforeSave(ctx, next) {
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
    let { modelName, personalizationRule: { postCustomFunction, fieldMask }, methodName } = data;
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

    if (fieldMask) {
      // eslint-disable-next-line no-inline-comments
      let fMaskPropNames = Object.keys(fieldMask); // all the fields/properties for the fieldMask

      let fmError = msg => createError(`Invalid fieldMask: ${msg}`);

      let fMaskDef = fMaskPropNames.reduce((carrier, fieldName) => {
        if (!carrier.hasInvalidFieldMaskDefinition) {
          let maskDefAtRoot = fieldMask[fieldName];
          let { modelProps } = carrier;
          let field = modelProps[fieldName];
          let fieldType = field.type;
          let isConstructor = typeof field.type === 'function';
          let isStringMask = 'stringMask' in maskDefAtRoot;
          let isNumberMask = 'numberMask' in maskDefAtRoot;
          let isDateMask = 'dateMask' in maskDefAtRoot;
          let isAMask = isStringMask || isDateMask || isNumberMask;
          if (isStringMask && isConstructor && fieldType !== String) {
            carrier.hasInvalidFieldMaskDefinition = true;
            carrier.error = fmError(`${fieldName} is of type ${fieldType.name}, expected ${String.name}`);
          } else if (isNumberMask && isConstructor && fieldType !== Number) {
            carrier.hasInvalidFieldMaskDefinition = true;
            carrier.error = fmError(`${fieldName} is of type ${fieldType.name}, expected ${Number.name}`);
          } else if (isDateMask && isConstructor && fieldType !== Date) {
            carrier.hasInvalidFieldMaskDefinition = true;
            carrier.error = fmError(`${fieldName} is of type ${fieldType.name}, expected ${Date.name}`);
          } else if (!isAMask && isConstructor && fieldType !== String) {
            carrier.hasInvalidFieldMaskDefinition = true;
            carrier.error = fmError(`${fieldName} is of type ${fieldType.name}, expected ${String.name}`);
          }
        }
        return carrier;
      }, { hasInvalidFieldMaskDefinition: false, modelProps: loopback.findModel(data.modelName).definition.properties });

      if (fMaskDef.hasInvalidFieldMaskDefinition) {
        return nextTick(() => next(fMaskDef.error));
      }
    }

    if (methodName) {
      let Model = loopback.findModel(modelName);
      if (!validateMethodName(Model, methodName)) {
        let e = createError(`methodName: ${methodName} for model ${modelName} is invalid`);
        return nextTick(() => next(e));
      }
    }

    nextTick(next);
  });
}

function isRemoteMethodAllowed(ctx, currentPersonalizationRecords) {
  let { _personalizationCache: { info }} = ctx;
  let firstRecord = currentPersonalizationRecords[0];

  if (info && firstRecord && info.modelName === firstRecord.modelName) {
    // ! this is probably called via a true remote pipeline
    let { methodName } = firstRecord;
    let {STAR, STAR_DOT_STAR, DOT, DOUBLE_STAR, PROTOTYPE_DOT_STAR, PROTOTYPE} = REMOTES;
    let isPattern = methodName.includes(STAR);
    let isPrototype = methodName.includes(PROTOTYPE);
    let hasDot = methodName.includes(DOT);

    let allowFlag = false;
    if (isPattern && !isPrototype && methodName === STAR) {
      //! when *
      // allow only static calls
      allowFlag = info.isStatic;
    } else if (isPattern && !isPrototype && methodName === DOUBLE_STAR) {
      //! ** - allow everthing
      allowFlag = true;
    } else if (isPattern && !isPrototype && hasDot && methodName === STAR_DOT_STAR) {
      //! all prototypes (*.*)
      allowFlag = !info.isStatic;
    } else if (isPattern && isPrototype && methodName === PROTOTYPE_DOT_STAR) {
      //! all prototypes (prototype.*)
      allowFlag = !info.isStatic;
    } else if (!isPattern && !isPrototype) {
      //! single static method (E.g. find, findById)
      allowFlag = info.isStatic && info.methodName === methodName;
    } else if (isPrototype && hasDot && !isPattern) {
      // single prototype method - (Eg. prototype.__get__orders)
      let protoMethod = methodName.substr(methodName.indexOf(DOT) + 1);
      allowFlag = !info.isStatic && info.methodName === protoMethod;
    }


    // TODO: consider adding an invert flag to invert the allowFlag,
    //    for e.g. disallow only findById, allow others,
    //    or disallow a custom remote method
    return allowFlag;
  }
  return true;
}

/**
 * Grabs data either from ctx.req.body
 * or ctx.result appropriately
 *
 * @param {HttpContext} ctx - the http context
 * @param {object} info - parsed context method string
 * @param {boolean} isBeforeRemote - flag denoting the stage - beforeRemote/afterRemote
 * @returns {object} - the model name and data are contained here
 */
function getPersonalizationMeta(ctx, info, isBeforeRemote) {
  let { modelName } = info;
  let data = null;

  let theModel = modelName;
  let { req } = ctx;
  let httpMethod = req.method;

  if (httpMethod === 'PUT' || httpMethod === 'POST' || httpMethod === 'PATCH') {
    data = isBeforeRemote ? ctx.req.body : ctx.result;
  } else {
    data = isBeforeRemote ? {} : ctx.result;
  }
  return { model: theModel, data };
}

/**
 * Main entry point for personalizations
 * via remote method call
 *
 * @param {httpContext} ctx - context
 * @param {boolean} isBeforeRemote - flag denoting the stage - beforeRemote/afterRemote
 * @param {callback} cb - to signal the personalizations are complete.
 */
function performPersonalizations(ctx, isBeforeRemote, cb) {
  let { _personalizationCache: { records, info } } = ctx;

  let pMeta = getPersonalizationMeta(ctx, info, isBeforeRemote);

  let options = { isBeforeRemote, context: ctx };

  applyServicePersonalization(pMeta.model, pMeta.data, records, options, cb);
}

const ALLOWED_INSTANCE_METHOD_NAMES = ['get', 'create', 'findById', 'updateById'];

/**
 * This methods detects some of loopback's
 * standard methods like exists, count and
 * exempts such requests to be personalized
 *
 * It also exempts requests which are
 * DELETE or HEAD
 *
 * @param {HttpContext} ctx - the http context object
 * @param {object} info - the parsed represetation of the context's methodString
 * @returns {boolean} - flag indicating if we can apply personalization
 */
function getCanApplyFlag(ctx, info) {
  let { methodName, isStatic } = info;
  let { req } = ctx;
  let httpMethod = req.method;

  let isAllowedPrototype = name => {
    let startIdx = 2;
    let endIdx = name.indexOf('_', startIdx);
    let extractedMethod = name.substr(startIdx, endIdx - startIdx);
    return ALLOWED_INSTANCE_METHOD_NAMES.some(value => value === extractedMethod);
  };

  if (httpMethod === 'DELETE' || httpMethod === 'HEAD') {
    return false;
  }

  if (isStatic && methodName === 'exists') {
    return false;
  }

  if (!isStatic && methodName.startsWith('__') && !isAllowedPrototype(methodName)) {
    return false;
  }

  return true;
}

/**
 * Initializes the pipeline for personalization
 *
 * @param {HttpContext} ctx - the http context object
 * @param {boolean} isBeforeRemote - flag denoting phase of the request
 * @param {function} cb - callback function to signal completion
 * @returns {undefined} - nothing
 */
function runPersonalizations(ctx, isBeforeRemote, cb) {
  let {methodString} = ctx;
  let info = parseMethodString(methodString);
  let canApply = null;

  if (isBeforeRemote) {
    canApply = getCanApplyFlag(ctx, info);
    ctx._personalizationCache = { canApply };
    if (canApply) {
      return fetchPersonalizationRecords(ctx, info.modelName, function (err, records) {
        if (err) {
          return cb(err);
        }
        ctx._personalizationCache = Object.assign(ctx._personalizationCache, { info, records });
        performPersonalizations(ctx, isBeforeRemote, cb);
      });
    }
  } else if (ctx._personalizationCache.canApply) {
    return performPersonalizations(ctx, isBeforeRemote, cb);
  }
  let stage = isBeforeRemote ? 'beforeRemote' : 'afterRemote';
  log.debug(ctx, `${stage}: Avoided personalization -> ${methodString}`);
  nextTick(cb);
}

/**
 * Personalizes data by mutating it.
 *
 * The personalization rules are queried
 * using the modelName.
 *
 * @param {string} modelName - name of model
 * @param {*} data - Array or Object
 * @param {ServicePersonalizationOptions} options - service personalization options
 *  Two properties:
 *    - isBeforeRemote - always false
 *    - context - the HttpContext object
 * @param {function} cb - the function to signal completion
 *   Has only one arguments - error
 * @returns {undefined} - nothing
 */
function performServicePersonalizations(modelName, data, options, cb) {
  let ctx = options.context;
  log.debug(ctx, `performServicePersonalizations: (enter) model -> ${modelName}`);
  let done = err => {
    log.debug(ctx, `performServicePersonalizations: (leave${err ? '- with error' : ''}) model -> ${modelName}`);
    cb(err);
  };
  ctx._personalizationCache = {};
  fetchPersonalizationRecords(ctx, modelName, function (err, records) {
    if (err) {
      return done(err);
    }
    applyServicePersonalization(modelName, data, records, options, done);
  });
}
module.exports = {
  loadCustomFunction,
  getCustomFunction,
  applyServicePersonalization,
  init,
  runPersonalizations,
  performServicePersonalizations
};
