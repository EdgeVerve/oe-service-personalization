/**
 *
 * ©2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
/**
 * Service personalization module. Optimizes and applies one personalization function.
 *
 * @module EV Service Personalizer
 * @author Atul Pandit, gourav_gupta, pradeep_tippa
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

/**
 *
 * This function returns personalization rule for modelName if exists.
 *
 * @param {String} modelName - Model Name
 * @param {object} ctx - context
 * @param {callback} callback - callback function
 * @function
 * @name getPersonalizationRuleForModel
 */
var getPersonalizationRuleForModel = function getPersonalizationRuleForModelFn(modelName, ctx, callback) {
  log.debug(ctx.req.callContext, 'getPersonalizationRuleForModel called for model - ', modelName);

  var PersonalizationRule = loopback.findModel('PersonalizationRule');

  var findByModelNameQuery = {
    where: {
      modelName: modelName,
      disabled: false
    }
  };

  PersonalizationRule.find(findByModelNameQuery, ctx.req.callContext, function getPersonalizationRuleForModelFindCb(err, result) {
    log.debug(ctx.req.callContext, 'Query result = ', result);
    if (err) {
      // TODO: Error getting personalization rule.. what should be done? Continue or stop?
      log.debug(ctx.req.callContext, 'Error getting personalization rule for model [', modelName, ']. skipping personalization');
      return callback(null);
    }

    if (result && result.length > 0) {
      log.debug(ctx.req.callContext, 'Returning personzalition rule');
      return callback(result[0]);
    }
    log.debug(ctx.req.callContext, 'Personalization rules not defined for model [', modelName, ']. skipping personalization');
    return callback(null);
  });
};

/**
 *
 * This function add functions to an array postProcessingFunctions which will execute to
 * apply personalization rules after getting result.
 *
 * @param {Object} ctx - loopback context
 * @param {Object} p13nRule - Personalization Rule
 * @param {callback} callback - callback function
 * @function
 * @name applyPersonalizationRule
 */

var applyPersonalizationRule = function applyPersonalizationRuleFn(ctx, p13nRule) {
  var arr = [];

  log.debug(ctx.req.callContext, 'applying Personalizing ctx with function - ', p13nRule);

  var instructions = Object.keys(p13nRule);

  // TODO:Check if all instructions can be applied in parallel in asynch way.
  // instructions.forEach(function (instruction) {

  for (var i in instructions) {
    if (instructions.hasOwnProperty(i)) {
      var instruction = instructions[i];
      switch (instruction) {
        case 'lbFilter':
          arr.push({
            type: 'lbFilter',
            fn: async.apply(addLbFilter, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(addLbFilter, ctx, p13nRule[instruction]));
          break;
        case 'filter':
          arr.push({
            type: 'filter',
            fn: async.apply(addFilter, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(addFilter, ctx, p13nRule[instruction]));
          break;
        case 'fieldReplace':
          arr.push({
            type: 'fieldReplace',
            fn: async.apply(addFieldReplace, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(addFieldReplace, ctx, p13nRule[instruction]));
          break;
        case 'fieldValueReplace':
          arr.push({
            type: 'fieldValueReplace',
            fn: async.apply(addFieldValueReplace, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(addFieldValueReplace, ctx, p13nRule[instruction]));
          break;
        case 'sort':
          arr.push({
            type: 'sort',
            fn: async.apply(addSort, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(addSort, ctx, p13nRule[instruction]));
          break;
        case 'postCustomFunction':
          arr.push({
            type: 'postCustomFunction',
            fn: async.apply(executeCustomFunction, ctx, p13nRule[instruction])
          });
          break;
        case 'union':
          // unionResults(ctx, p13nRule[instruction]);
          break;
        case 'mask':
          arr.push({
            type: 'mask',
            fn: async.apply(maskFields, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(maskFields, ctx, p13nRule[instruction]));
          break;
        case 'fieldMask':
          arr.push({
            type: 'fieldMask',
            fn: async.apply(maskCharacters, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(maskCharacters, ctx, p13nRule[instruction]));
          break;
        default:
      }
    }
  }
  return arr.sort(sortFactoryFn());
};

function execute(arr, callback) {
  async.parallel(arr, function applyPersonalizationRuleAsyncParallelFn(err, results) {
    if (err) {
      return callback(err);
    }
    callback();
  });
}

function addFieldValueReplace(ctx, instruction, cb) {
  return fieldValueReplacementFn(ctx, instruction, cb);
}


/* eslint-disable no-loop-func */
var applyReversePersonalizationRule = function applyReversePersonalizationRuleFn(ctx, p13nRule, callback) {
  log.debug(ctx.options, 'Reverse Personalizing ctx with function - ', p13nRule);

  var instructions = Object.keys(p13nRule);

  var arr = [];
  // TODO:Check if all instructions can be applied in parallel in asynch way.
  // instructions.forEach(function (instruction) {

  for (var i in instructions) {
    if (instructions.hasOwnProperty(i)) {
      var instruction = instructions[i];
      switch (instruction) {
        case 'fieldReplace':
          arr.push({
            type: 'fieldReplace',
            fn: async.apply(addReverseFieldReplace, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(addReverseFieldReplace, ctx, p13nRule[instruction]));
          break;
        case 'fieldValueReplace':
          arr.push({
            type: 'fieldValueReplace',
            fn: async.apply(addReverseFieldValueReplace, ctx, p13nRule[instruction])
          });
          // arr.push(async.apply(addReverseFieldValueReplace, ctx, p13nRule[instruction]));
          break;
        case 'preCustomFunction':
          arr.push({
            type: 'preCustomFunction',
            fn: async.apply(executeCustomFunction, ctx, p13nRule[instruction])
          });
          break;
        default:
      }
    }
  }
  return arr.sort(sortFactoryFn(true));
};
/* eslint-enable no-loop-func */

function addReverseFieldValueReplace(ctx, instruction, cb) {
  reverseFieldValueReplacementFn(ctx, instruction, cb);
}

function addReverseFieldReplace(ctx, instruction, cb) {
  reverseFieldReplacementFn(ctx, instruction, cb);
}


/**
 * Function to add 'where' clause in the datasource filter query.
 */

function addWhereClause(ctx, instruction, cb) {
  if (typeof instruction === 'string') {
    exprLang(instruction).then(function addWhereClauseInstrResultCb(result) {
      addWheretoCtx(ctx, result.value.where, cb);
    });
  } else {
    addWheretoCtx(ctx, instruction, cb);
  }
}

function addWheretoCtx(ctx, where, cb) {
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
}

/**
 * Function to add filter clause in query.
 */

function addLbFilterClause(ctx, instruction, cb) {
  if (typeof instruction === 'string') {
    exprLang(instruction).then(function addLbFilterInstrResultCb(result) {
      addLbFiltertoCtx(ctx, result.value, cb);
    });
  } else {
    addLbFiltertoCtx(ctx, instruction, cb);
  }
}

function addLbFiltertoCtx(ctx, filter, cb) {
  ctx.args.filter = ctx.args.filter || {};
  mergeQuery(ctx.args.filter, filter);
  cb();
}

/*
 * Object wrapper to add a processing function in the context.
 * Wraps the instrunctions and reference to the actual function to be called.
 * Processing functions are invoked before posting data or after data is retried by the API
 *
 */

function ProcessingFunction(instruction, fn) {
  this.instruction = instruction;
  this.fn = fn;

  this.execute = function processingFunctionExecuteFn(ctx) {
    // console.log('this.instruction = ' + JSON.stringify(this.instruction));
    // console.log('this.fn = ' + this.fn);

    this.fn(ctx, instruction);
  };
}


function fieldReplacementFn(ctx, replacements, cb) {
  var input;
  var result = ctx.result || ctx.accdata;

  if (typeof result !== 'undefined' && !_.isEmpty(result)) {
    input = ctx.result || ctx.accdata;
    log.debug(ctx.options, 'fieldValueReplacementFn called. Resultset = ',
      input + ' Replacements = ' + replacements);
  } else if (typeof ctx.req.body !== 'undefined' && !_.isEmpty(ctx.req.body)) {
    input = ctx.req.body;
    log.debug(ctx.req.callContext, 'reverseFieldValueReplacementFn called. Input = ',
      input + ' Replacements = ' + replacements);
  } else {
    return cb();
  }

  // let replaceField = utils.replaceField;
  let replaceRecord = utils.replaceRecord;

  /**
   * if input or result is array then iterates the process
   * otherwise once calls update record function.
   */
  if (Array.isArray(input)) {
    var updatedResult = [];
    for (var i in input) {
      if (input.hasOwnProperty(i)) {
        var record = input[i];
        updatedResult.push(replaceRecord(record, replacements));
      }
    }
    input = updatedResult;
  } else {
    var updatedRecord = replaceRecord(input, replacements);
    input = updatedRecord;
  }

  process.nextTick(function () {
    return cb();
  });
}

function reverseFieldReplacementFn(ctx, rule, cb) {
  // var input = ctx.args.data;

  if (rule !== null && typeof rule !== 'undefined') {
    var revInputJson = {};

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
    fieldReplacementFn(ctx, revInputJson, cb);
  } else {
    return cb();
  }
}

/**
 * Field value replacement function. To be used when datasource does not support field value replacements.
 * It simply iterates over the resultset and carries our field value replacements.
 *
 * @param {Object} ctx - loopback context
 * @param {Object} replacements - field value replacement rule
 * @function
 * @name fieldValueReplacementFn
 */


/**
 * Reverse Field value replacement function. To be used for reverting field value replacements.
 * It simply iterates over the posted data and reverts field value replacements.
 *
 * @param {Object} ctx - loopback context
 * @param {Object} rule - field value replacement rule
 * @function
 * @name reverseFieldValueReplacementFn
 */

function reverseFieldValueReplacementFn(ctx, rule, cb) {
  // var input = ctx.args.data;

  if (rule !== null && typeof rule !== 'undefined') {
    var revInputJson = {};
    for (var field in rule) {
      if (rule.hasOwnProperty(field)) {
        var temp = {};
        var rf = rule[field];
        for (var key in rf) {
          if (rf.hasOwnProperty(key)) {
            temp[rf[key]] = key;
          }
        }

        revInputJson[field] = temp;
      }
    }
    fieldValueReplacementFn(ctx, revInputJson, cb);
  } else {
    return process.nextTick(function () {
      return cb();
    });
  }
}

// old code
function executeCustomFunctionFn(ctx, customFunctionName) {
  // TODO: Security check
  // var custFn = new Function('ctx', customFunction);
  var custFn = function customFnn(ctx, customFunction) {
    customFunction(ctx);
  };

  log.debug(ctx.options, 'function - ', customFunction);
  custFn(ctx);
}

// execute custom function
function executeCustomFunction(ctx, instruction, cb) {
  let customFunctionName = instruction.functionName;
  customFunction[customFunctionName](ctx);
  cb();
}


/**
 * Processes a 'filter' instruction. This method checks if underlying datasource to which the model is attached to
 * supports query based filtering. If yes, it adds a 'where' clause in the query. Otherwise creates a post processing
 * function which performs filtering on the resultset retrieved.
 * @param  {object} ctx - context.
 * @param  {object} instruction - instructions.
 * @param  {function} cb - callback function.
 */
function addFilter(ctx, instruction, cb) {
  // TODO: Check the datasource to which this model is attached.
  // If the datasource is capable of doing filter queries add a where clause.

  var dsSupportFilter = true;

  if (dsSupportFilter) {
    addWhereClause(ctx, instruction, cb);
  }
  // else {}
}

// Processes a filter instruction. filter instruction schema is same like loopback filter schema.
function addLbFilter(ctx, instruction, cb) {
  addLbFilterClause(ctx, instruction, cb);
}

/**
 * Processes a 'fieldValueReplace' instruction.
 * This method checks if underlying datasource to which the model is attached
 * to supports 'field value' replacements.
 * If yes, it delegates it to datasource by modifying the query.
 * Otherwise creates a post processing function which performs field
 * value replacements by iterating the results retrieved.
 */

function fieldValueReplacementFn(ctx, replacements, cb) {
  var input;

  var result = ctx.result || ctx.accdata;

  if (typeof result !== 'undefined' && !_.isEmpty(result)) {
    input = ctx.result || ctx.accdata;
    log.debug(ctx.options, 'fieldValueReplacementFn called. Resultset = ',
      input + ' Replacements = ' + replacements);
  } else if (typeof ctx.instance !== 'undefined' && !_.isEmpty(ctx.instance)) {
    input = ctx.instance;
    log.debug(ctx.options, 'reverseFieldValueReplacementFn called. Input = ',
      input + ' Replacements = ' + replacements);
  } else {
    return process.nextTick(function () {
      return cb();
    });
  }


  // function replaceValue(record, replacement, value) {
  //   var pos = replacement.indexOf('\uFF0E');
  //   var key;
  //   var elsePart;
  //   if (pos !== null && typeof pos !== 'undefined' && pos !== -1) {
  //     key = replacement.substr(0, pos);
  //     elsePart = replacement.substr(pos + 1);
  //   } else {
  //     key = replacement;
  //   }


  //   if (typeof record[key] !== 'undefined' && Array.isArray(record[key])) {
  //     var newValue = record[key];
  //     record[key].forEach(function (element, index) {
  //       if (value[element]) {
  //         newValue[index] = value[element];
  //       }
  //     });
  //     if (typeof record.__data !== 'undefined') {
  //       record.__data[key] = newValue;
  //     } else {
  //       record[key] = newValue;
  //     }
  //   } else if (typeof record[key] !== 'undefined' && typeof record[key] === 'object') {
  //     replaceValue(record[key], elsePart, value);
  //   } else if (typeof record[key] !== 'undefined' && typeof record[key] !== 'object') {
  //     if (value.hasOwnProperty(record[key])) {
  //       if (typeof record.__data !== 'undefined') {
  //         record.__data[key] = value[record[key]];
  //       } else {
  //         record[key] = value[record[key]];
  //       }
  //     }
  //   }
  // }

  // function replaceRecord(record, replacements) {
  //   var keys = Object.keys(JSON.parse(JSON.stringify(replacements)));
  //   for (var attr in keys) {
  //     if (keys.hasOwnProperty(attr)) {
  //       replaceValue(record, keys[attr], replacements[keys[attr]]);
  //     }
  //   }
  //   return record;
  // }

  let replaceRecord = utils.replaceRecordFactory(utils.replaceValue);

  if (Array.isArray(input)) {
    var updatedResult = [];
    for (var i in input) {
      if (input.hasOwnProperty(i)) {
        var record = input[i];
        updatedResult.push(replaceRecord(record, replacements));
      }
    }
    input = updatedResult;
  } else {
    var updatedRecord = replaceRecord(input, replacements);
    input = updatedRecord;
  }
  process.nextTick(function () {
    return cb();
  });
}

function addFieldReplace(ctx, instruction, cb) {
  fieldReplacementFn(ctx, instruction, cb);
}

// Function to add Sort (Order By) to the query.
function addSort(ctx, instruction, cb) {
  // { order: 'propertyName <ASC|DESC>' }                                    -- sort by single field
  // { order: ['propertyName <ASC|DESC>', 'propertyName <ASC|DESC>',...] }   --sort by mulitple fields

  var dsSupportSort = true;
  if (dsSupportSort) {
    var query = ctx.args.filter || {};
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
      var orderExp = createOrderExp(instruction, tempKeys);

      if (typeof query.order === 'undefined') {
        query.order = orderExp;
      } else {
        query.order = query.order.concat(orderExp);
      }
      query.order = _.uniq(query.order);
      ctx.args.filter = ctx.args.filter || {};
      ctx.args.filter.order = query.order;
      cb();
    } else {
      cb();
    }
  } else {
    addPostProcessingFunction(ctx, 'sortInMemory', instruction, sortInMemory);
    cb();
  }
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

/* eslint-disable */
function addCustomFunction(ctx, instruction, cb) {
  // instruction has the customFunction Name
  // Datasource does not support field name replacement. Add it as a post processing function
  addPostProcessingFunction(ctx, 'customFunction', instruction, executeCustomFunctionFn);
  cb();
}
/* eslint-enable */

function createOrderExp(instruction, tempKeys) {
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
/* To be used when database doesnt support sort OR sort needs to be done in memory*/
function sortInMemory(ctx, options) {
  var result = ctx.result;
  if (typeof result === 'undefined') {
    return;
  }
  if (!Array.isArray(options)) {
    options = [options];
  }
  var keys = [];
  var values = [];
  for (var index in options) {
    if (options.hasOwnProperty(index)) {
      var key = Object.keys(options[index])[0];
      values.push(options[index][key]);
      key = key.indexOf('|') > -1 ? key.replace(/\|/g, '.') : key;
      keys.push(key);
    }
  }
  var updatedResults;
  if (Array.isArray(result)) {
    // lodash version 3.10.1 uses sortByOrder;version 4.0.0 uses OrderBy
    updatedResults = _.orderBy(result, keys, values);
  }
  if (updatedResults) {
    ctx.result = updatedResults;
  }
}

/**
 * Instantiate a new post processing function and adds to the request context.
 */

function addPostProcessingFunction(ctx, func, instruction, fn) {
  var callContext = ctx.req.callContext = ctx.req.callContext || {};

  callContext.postProcessingFns = callContext.postProcessingFns || {};
  callContext.postProcessingFns[callContext.modelName] = callContext.postProcessingFns[callContext.modelName] || [];
  var prcFn = new ProcessingFunction(instruction, fn);
  var addPrcFn = callContext.postProcessingFns[callContext.modelName].some(function (processingFn) {
    return processingFn.fn.name === prcFn.fn.name;
  });
  if (!addPrcFn) {
    if (func === 'fieldReplace') {
      callContext.postProcessingFns[callContext.modelName].push(prcFn);
    } else {
      callContext.postProcessingFns[callContext.modelName].unshift(prcFn);
    }
  }
  // console.log('callContext so far - ' + JSON.stringify(callContext));
}

/*
     * Function to mask the certain fields from the output field List
     * */
function maskFields(ctx, instruction, cb) {
  var dsSupportMask = true;
  if (dsSupportMask) {
    ctx.args.filter = ctx.args.filter || {};
    var query = ctx.args.filter;
    if (!query) {
      return cb();
    }
    var keys = Object.keys(instruction);
    var exp = {};
    if (typeof query.fields === 'undefined') {
      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        key = key.indexOf('|') > -1 ? key.replace(/\|/g, '.') : key;
        exp[key] = false;
      }
      query.fields = exp;
    }
    // else {
    //    var fieldList = query.fields;
    //    fieldList = _.filter(fieldList, function (item) {
    //        return keys.indexOf(item) === -1
    //    });
    //    query.fields = fieldList;
    // }
  }
  cb();
}

function maskCharacters(ctx, charMaskRules, cb) {
  var input;
  var result = ctx.result || ctx.accdata;

  if (result && !_.isEmpty(result)) {
    input = result;
  } else if (ctx.req.body && !_.isEmpty(ctx.req.body)) {
    input = ctx.req.body;
  } else {
    return cb();
  }

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

  return cb();
}

const utils = {
  /**
   * field replacer function
   * 
   * @param {instance or data} record - the model instance or plain data
   * @param {object} replacement - personalization rule (for field name replace)
   * @param {string} value - new field name
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
   * @param {instance or data} record - the model instance or data
   * @param {object} replacement - the personalization rule (for field value replace)
   * @param {string} value - the value to replace
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
      replaceValue(record[key], elsePart, value);
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
    }
  },

  noop() {
    // do nothing
  }
};


// const ALT_DOT = '\uFF0E'

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
  fieldReplace(replacements, isBeforeRemote = false) { //Tests: t1, t15
    
    let replaceRecord = utils.replaceRecordFactory(utils.replaceField);
    
    let process = function(replacements, data, cb) {
      if (Array.isArray(data)) {
        let updatedResult = data.map(record => {
          return replaceRecord(record, replacements);
        });
        data = updatedResult;
      }
      else {
        data = replaceRecord(data, replacements);
      }

      nextTick(cb);
    };

    if(isBeforeRemote) {
      return function(data, callback) {
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
      }
    }

    // ! for afterRemote case
    return function (data, callback) {
      process(replacements, data, callback);
    }
  },

  fieldValueReplace(replacements) {

    return function (data, callback) {
      let replaceRecord = utils.replaceRecordFactory(utils.replaceValue);
      if (Array.isArray(data)) {
        let updatedResult = data.map(record => {
          return replaceRecord(record, replacements);
        });
        data = updatedResult;
      }
      else {
        data = replaceRecord(data, replacements);
      }

      nextTick(callback);
    }
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
  addSort(ctx, instruction) { //Tests: t4, t5, t6, t7, t8, t10, t11
    return function (data, callback) {
      utils.noop(data);
      var dsSupportSort = true;
      if (dsSupportSort) {
        var query = ctx.args.filter || {};
        //TODO: (Arun 2020-04-24 19:43:38) - what if no filter?
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
          var orderExp = createOrderExp(instruction, tempKeys);

          if (typeof query.order === 'undefined') {
            query.order = orderExp;
          } else {
            query.order = query.order.concat(orderExp);
          }
          query.order = _.uniq(query.order);
          ctx.args.filter = ctx.args.filter || {};
          ctx.args.filter.order = query.order;
          nextTick(callback);
        } else {
          cb();
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
    }
  },

  /**
   * Mask helper function for masking a field
   * 
   * @param {CallContext} ctx - the request context
   * @param {object} instructions - personalization rule object
   * 
   * Tests: t13
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
  mask(ctx, instructions) {
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

        //TODO: (Arun - 2020-04-24 11:17:11) shouldn't we uncomment the following?

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
  addFilter(ctx, instruction) {// Tests: t9
    return function (data, callback) {
      utils.noop(data);

      //TODO: (Arun 2020-04-24 20:16:02) - how to check for datasource support?

      //TODO: (Arun 2020-04-24 20:16:47) - implement in-memory filter if datasource unsupported
      var dsSupportFilter = true;

      if (dsSupportFilter) {
        addWhereClause(ctx, instruction, callback);
      }
    }
  }
}
/**
 * Apply the personalization on the given data
 * 
 * @param {bool} isReverse - flag indicating if reverse personalization is to be applied
 * @param {object} instructions - object containing personalization instructions
 * @param {List or Instance} data - data from the context. Could either be a List of model instances or a single model instance
 * @param {function} done - the callback which receives the new data. First argument of function is an error object
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
          return { type: 'fieldReplace', fn: p13nFunctions.fieldReplace(instruction, true)}
        default:
          return { type: `${operation}:noop`, fn: p13nFunctions.noop }
      }
    });
  }
  else {
    tasks = Object.entries(instructions).map(([operation, instruction]) => {
      switch (operation) {
        case 'fieldReplace':
          return { type: 'fieldReplace', fn: p13nFunctions.fieldReplace(instruction) };
        case 'fieldValueReplace':
          return { type: 'fieldValueReplace', fn: p13nFunctions.fieldValueReplace(instruction) };
        default:
          return { type: `${operation}:noop`, fn: p13nFunctions.noop }
      }
    });
  }

  let asyncIterator = function ({ type, fn }, done) {
    log.debug(ctx, `${isBeforeRemote ? "beforeRemote" : "afterRemote"}: applying function - ${type}`);
    fn(data, function (err) {
      done(err);
    });
  };

  async.each(tasks.sort(sortFactoryFn(isBeforeRemote)), asyncIterator, function asyncEachCb(err) {
    if (err) {
      done(err)
    }
    else {
      done();
    }
  });
}


function checkRelationAndRecurse(Model, data, personalizationOptions, done) {

  if (Model.definition.relations.length > 0) {
    throw Error('not implemented');
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
    }
    else {
      // let { instructions } = entries[0];
      // personalize(reverse, instructions, data, done);
      if (entries.length == 0) {
        //! not needed to personalize here,
        //! however we need to check for related
        //! model
        checkRelationAndRecurse(Model, data, personalizationOptions, function (err) {
          if (err) {
            done(err)
          }
          else {
            done();
          }
        });
      }
      else {
        personalize(context, isBeforeRemote, entries[0].personalizationRule, data, function (err) {
          if (err) {
            done(err);
          }
          else {
            checkRelationAndRecurse(Model, data, personalizationOptions, function (err) {
              if (err) {
                done(err);
              }
              else {
                done();
              }
            });
          }
        });
      }
    }
  }); //PersonalizationRule.find() - end
}

let PersonalizationRule = null;
/**
 * Initializes this module for service personalization
 * 
 * @param {Application} app - The Loopback application object
 */
function init(app) {
  PersonalizationRule = app.models['PersonalizationRule'];
}

module.exports = {
  getPersonalizationRuleForModel: getPersonalizationRuleForModel,
  applyPersonalizationRule: applyPersonalizationRule,
  applyReversePersonalizationRule: applyReversePersonalizationRule,
  execute: execute,
  loadCustomFunction,
  getCustomFunction,
  applyServicePersonalization,
  init
};
