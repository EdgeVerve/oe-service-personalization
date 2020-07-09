# oe-service-personalization

This module will apply operations such as field masking, hiding
fields, sorting, etc on top of traditional remote endpoints, 
thereby "personalizing" them. With these limited set of 
operations it is also possible to personalize data to a group 
of clients. In other words, the same data can appear (and/or 
behave differently) on, say, an android app, an ios app, and, 
a browser app. 

Such granular differenciations are possible by describing them 
in an property called `scope` on the personalization rule. 
(This is made possible by the `oe-personalization` module). 
Further, for such segmented personalizations to take effect, we 
need the necessary header in the http request (as how it is in 
the `scope`).

Such kind of personalizations allows for us to be able to 
derive analytics on the groups or segmentations which would 
in-turn allow us to focus more on servicing those groups better. 
For e.g. assume there is an api. Further assume, it is 
personalized for both a mobile client and a browser client. 
Once deployed, we can derive the analytics by looking at 
server logs for the same api and decide which platform that api 
is frequently accessed. Such information can be used to improve 
the user experience on that platform. However, this is not in 
scope of this document.

## Table Of Contents
- [oe-service-personalization](#oe-service-personalization)
  - [Table Of Contents](#table-of-contents)
  - [Dependency](#dependency)
  - [Install and test](#install-and-test)
  - [Main features](#main-features)
  - [`PersonalizationRule` model](#-personalizationrule--model)
    - [Important properties](#important-properties)
    - [Acceptable values for `methodName`](#acceptable-values-for--methodname-)
  - [How to use](#how-to-use)      
  - [Working Principle](#working-principle)
  - [Supported operations](#supported-operations)
  - [**fieldMask** options](#--fieldmask---options)
    - [fieldMask for strings](#fieldmask-for-strings)
    - [fieldMask for numbers](#fieldmask-for-numbers)
    - [fieldMask for date](#fieldmask-for-date)
  - [Operations on objects](#operations-on-objects)
  - [Programmatic API](#programmatic-api)
    - [1. Using model name, and, model data](#1-using-model-name--and--model-data)
    - [2. Using model name, data, and, personalization rules](#2-using-model-name--data--and--personalization-rules)
  - [Significance of pre-fetch/post-fetch operations](#significance-of-pre-fetch-post-fetch-operations)
  - [Points to consider](#points-to-consider)
  - [Test Synopsis](#test-synopsis)
  - [Note on loopback relations](#note-on-loopback-relations)

## Dependency

* oe-cloud
* oe-logger
* oe-expression
* oe-personalization

## Install and test

```sh
$ git clone http://evgit/atul/oe-service-personalization.git
$ cd oe-service-personalization
$ npm install --no-optional
$ # Just run test cases
$ npm run test
$ # Run test cases along with code coverage - code coverage report will be available in coverage folder
$ npm run grunt-cover
```

## Main features

- Customizing remote responses, or data 
(i.e. queried via loopback model api),
 to appear in a certain manner
  - Based on user role
  - Custom scope - for e.g. for android, or, ios clients
- Limiting personalization to apply to a particular remote method

## `PersonalizationRule` model

This is the framework model is used to store personalization rules.

```json
{
  "name": "PersonalizationRule",
  "base": "BaseEntity",
  "plural": "PersonalizationRules",
  "description": "Service Personalization metadata",
  "idInjection": false,
  "strict": true,
  "options": {
    "validateUpsert": true,
    "isFrameworkModel": true
  },
  "properties": {
    "ruleName": {
      "type": "string"
    },
    "disabled": {
      "type": "boolean",
      "default": false
    },
    "modelName": {
      "type": "string",
      "required": true,
      "unique": true,
      "notin": [
        "PersonalizationRule"
      ]
    },
    "personalizationRule": {
      "type": "object",
      "required": true
    },
    "methodName" : {
      "type": "string",
      "default": "**",
      "description": "The model methodName this rule should apply to. Should be the methodName (static/instance) or wildcards you specify in a afterRemote()/beforeRemote(). Default '**'"
    }
  },
  "validations": [],
  "relations": {},
  "acls": [],
  "methods": {},
  "mixins": {}
}
```

### Important properties
1. `modelName` - the target model for which the personalization should apply
2. `personalizationRule` - the json object which stores operations to apply. More in the `How to Use` and `Supported operations` sections
3. `disabled` - boolean flag which instructs framework to apply personalization or not - default _false_ (i.e. apply the personalizations)
4. `methodName` - the method for which personalization has to apply - default `**` - i.e. apply to all static and instance methods. See below for acceptable values.
5. `ruleName` - (_optional_) name for the personalization rule. Used for debugging.
6. `scope` - (_optional_) used to control personalization based on roles
or through http headers (by the api consumers). For e.g.
it can have a value `{ "roles" : ['admin'] }`... 
it means, personalization will apply for a 
logged-in `admin` user only.

### Acceptable values for `methodName`

It can accept the following patterns (wildcards and names)
- `**` (_default_) - all static and instance methods
- `*` - only static methods
- `*.*` or `prototype.*` - only instance methods
- **Valid static method name**. It can be standard, 
or, a custom static remote method.
- **Valid instance method name**. It can be standard, 
or, a custom instance remote method. 
E.g. `prototype.foo`, where `foo` is a method 
defined on the prototype of the model's constructor.

See section `Notes on loopback relations` for more information.

## How to use

This documents a general usage pattern - achieving 
personalization via call to the http endpoint
of the model.

The same can be done through code. Refer to `Programmatic Api` section for the same.

#### 1. Install the module to your application

```
npm install oe-service-personalization
```
#### 2. Add config to your project's `app-list.json`:

```
  {
    "path": "oe-service-personalization",
    "enabled": true    
  }
```

If you require role-based service personalization, add `oe-personalization` depedency prior to `oe-service-personalization`
```
  {
    "path": "oe-personalization",
    "enabled": true,
    "autoEnableMixins": true
  },
  {
    "path": "oe-service-personalization",
    "enabled": true    
  }
```

#### 3. Add `ServicePersonalizationMixin` mixin to the model declaration.

Example:
```json
{
  "name": "ProductOwner",
  "base": "BaseEntity",
  "idInjection": true,
  "properties": {
    "name": {
      "type": "string"
    },
    "city": {
      "type": "string",
	    "require" : true
    }
  },
  "validations": [],
  "relations": {
    "ProductCatalog": {
      "type": "hasMany",
      "model": "ProductCatalog"
    },
    "address": {
      "type" : "hasOne",
      "model" : "AddressBook"
    }
  },
  "acls": [],
  "methods": {},
  "mixins": {
    "ServicePersonalizationMixin" : true
  }
}

```
#### 4. Insert rules into the `PersonalizationRule` model.

Example:
```json
{
    "disabled" : false,
    "modelName" : "ProductCatalog",
    "personalizationRule" : {
        "fieldValueReplace" : {
            "keywords" : {
                "Alpha" : "A",
                "Bravo" : "B"
            }
        }
    },
    "scope" : {
        "device" : "mobile"
    }
}
```

The above example adds a `fieldValueReplace` operation to the 
`keywords` property of `ProductCatalog` model. Additionally
we have provided `scope` for this rule to take effect only
when it is specified in the http headers of the request; it 
is always a simple key/value pair. See section `Supported operations`
for info about more operations.

To have this personalization apply only to a user of a specified
role (say to either `tellers` or `agents`), it must be defined as in the below example:

Example:
```json
{
    "disabled" : false,
    "modelName" : "ProductCatalog",
    "personalizationRule" : {
        "fieldValueReplace" : {
            "keywords" : {
                "Alpha" : "A",
                "Bravo" : "B"
            }
        }
    },
    "scope" : {
        "roles" : ["teller", "agent"]
    }
}
```


#### 5. _(Optional)_ Configure custom functions path

If there are custom function operations, add the path in the application's `config.json`
file. Alternatively, set the environment variable: 
`custom_function_path`

Example: (`config.json` snippet):

```json
  "servicePersonalization" : {
    "customFunctionPath": "D:\\Repos\\oecloud.io\\oe-service-personalization_master\\test\\customFunction"
  }
```
Example: (via environment variable) (bash prompt):
```bash
$ export custom_function_path="/project/customFuncDir"
```
> Note: the full path to the directory is required.

## Working Principle

All models with the `ServicePersonalizationMixin` 
enabled will have functions attached
to its `afterRemote()` and `beforeRemote()` which will
do the personalization.

The personalization records, stored in `PersonalizationRule`,
are queried according to scope, and, model participating in
the remote call. The information  required for this
is obtained from the `HttpContext` which is an argument in
the callback of the aforementioned methods.

After this, these steps are done:

1. personalization is applied at the root model, i.e. the 
one that participates in the remote call.
2. personalization is then applied to any relations
3. personalization is applied to all properties 
of the root model, which are model constructors

Personalization can happen through code also via `performServicePersonalization()`
or, `applyServicePersonalization()`
api calls. They follow the same process mentioned above,
however, there are a few limitations. Notably, those 
operations which are meant to apply `post-fetch` will 
be honoured, and, thus personalized.

More details on `pre-fetch` and `post-fetch` in sections below. (_Significance of pre-fetch & post-fetch_)

## Supported operations

To keep this document brief, a short description about each
operation is only given. Please visit the tests to see
example usages. It is recommended to review the tests synopsis 
section if debugging the tests are necessary. 

The one and only test file can be found in this project's 
folder here: 
```
./test/test.js
```

Below is the list of all supported operations and their 
corresponding tests:

| Operation          | Description                                                                                                   | Aspect               | Tests                                 |
|--------------------|---------------------------------------------------------------------------------------------------------------|----------------------|---------------------------------------|
| lbFilter           | This applies a loopback filter  to the request; it can contain an _include_ clause or a _where_ clause.       | pre-fetch            | t21                                   |
| filter             | Same as above, but only adds the where clause to the request i.e.  a query-based filter                       | pre-fetch            | t9                                    |
| sort               | Performs a sort at the datasource level                                                                       | pre-fetch            | t4, t5, t6, t7, t8, t10, t11          |
| fieldReplace       | Replaces the property name in the data with another text. (Not its value)                                     | pre-fetch/post-fetch | t1, t15, t17                          |
| fieldValueReplace  | Replaces the property value in the data                                                                       | pre-fetch/post-fetch | t22, t20, t19, t18, t17, t16, t3, t23 |
| fieldMask          | Masks value in the field according to a regex pattern. More details in the section of fieldMask                                                         | post-fetch           | t24, t25, t26, t27, t28, t29          |
| mask               | Hides a field in the response                                                                                 | pre-fetch            | t13                                   |
| postCustomFunction | Adds a custom function which can add desired customization to response. Please see step #5 in how to use.     | post-fetch           | t35, t36                              |
| preCustomFunction  | Adds a custom function which can add desired customization to the request. Please see step  #5 in how to use. | pre-fetch            | t35, t36                              |


## **fieldMask** options

Prior to version 2.4.0, a field mask definition looks like this:

```json
{
  "modelName": "ProductCatalog",
  "personalizationRule": {
    "fieldMask": {
      "modelNo": {
        "pattern": "([0-9]{3})([0-9]{3})([0-9]{4})",
        "maskCharacter": "X",
        "format": "($1) $2-$3",
        "mask": [
          "$3"
        ]
      }
    }
  },
  "scope": {
    "region": "us"
  }
}
```

This is still supported. The framework assumes 
`modelNo` in this example to be of type `String` 
and performs validation before insert into 
`PersonalizationRule` model.

The **fieldMask** operations can be applied to the following data types:
- String
- Number
- Date

Validation will happen for the same at the time of creating
the PersonalzationRule record, i.e., type validation on the
field will take place against the same field in the target
model.

### fieldMask for strings

Formal way to specify masking data of type `String` is as follows:

```json
{
  "modelName": "ProductCatalog",
  "personalizationRule": {
    "fieldMask": {
      "modelNo": {
        "stringMask" : {
          "pattern": "([0-9]{3})([0-9]{3})([0-9]{4})",
          "maskCharacter": "X",
          "format": "($1) $2-$3",
          "mask": [
            "$3"
          ]
        }
        
      }
    }
  },
  "scope": {
    "region": "us"
  }
}
```

### fieldMask for numbers

Formal way to specify masking of numbers is as follows:
```json
{
  "modelName": "ProductCatalog",
  "personalizationRule": {
    "fieldMask": {
      "modelNo": {
        "numberMask" : {
          "pattern": "([0-9]{3})([0-9]{3})([0-9]{4})",
          "maskCharacter": "X",
          "format": "($1) $2-$3",
          "mask": [
            "$3"
          ]
        }
        
      }
    }
  },
  "scope": {
    "region": "us"
  }
}
```

> Note: the options are similar to that of `stringMask`.
Validation is done to determine if modelNo is of type `Number`

### fieldMask for date

Formal way to specify masking of dates are as follows:
```json
{
  "modelName": "XCustomer",
  "personalizationRule": {
    "fieldMask": {
      "dob": {
        "dateMask": {
          "format": "MMM/yyyy"
        }
      }
    }
  }
}
```
The `format` in a `dateMask` field accepts any valid joda-time string. It is also
assumed to be of the `en_us` locale by default. Characters
intended for masking can be embedded in the format string itself,
however, they are a limited set, as, certain commonly used 
characters like `x` or `X` have special meaning in the joda
standard.

A `locale` option can be passed
alternatively specifying a different locale. Acceptable values (`String`) are:
- ENGLISH
- US (_default_)
- UK
- CANADA
- FRENCH
- FRANCE
- GERMAN
- GERMANY

For more info about joda-time format visit: https://js-joda.github.io/js-joda/manual/formatting.html#format-patterns

## Operations on objects

Operations such as `fieldMask`, `fieldValueReplace`, etc can be 
applied on properties of type `Object`.

The path to the nested property can be specified by using
the unicode character `\uFF0E` as seperator. 

Example (test `t31`):

```json
{
  "modelName": "Customer",
  "personalizationRule": {
    "fieldReplace": {
      "billingAddress\uFF0Estreet": "lane"
    }
  },
  "scope": {
    "device": "android"
  }
}
```

## Programmatic API

There are two flavours of api wrt personalization. Both are available in the following namespace:

```
oe-service-personalization/lib/api
```

### 1. Using model name, and, model data

Use  `performServicePersonalizations()` api.

The signature is as follows:

```js
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
  // ...
}
```

Example

```JavaScript

const { performServicePersonalizations } = require('./../../../lib/api'); // or require('oe-service-personalization/lib/api');
const loopback = require('loopback');

module.exports = function(PseudoProductOwner) {
  PseudoProductOwner.remoteMethod('demandchain', {
    description: 'Gets the stores, store addresses, and, contacts of a product owner',
    accepts: [
      {
        arg: 'id',
        type: 'number',
        description: 'the unique id of the owner',
        required: true
      },
      {
        arg: 'options',
        type: 'object',
        http:function(ctx) {
          return ctx;
        }
      }
    ],
    returns: {
      arg: 'chain',
      root: true,
      type: 'object'
    },
    http: { path: '/:id/demandchain', verb: 'get' }
  });

  PseudoProductOwner.demandchain = function(ownerId, options, done) {
    if(typeof done === 'undefined' && typeof options === 'function') {
      done = options;
      options = {};
    };
    let ProductOwner = loopback.findModel('ProductOwner');
    let filter = {
      "include": [ 
        {
          "ProductCatalog" : {
            "store": {
              "store" : { 
                "addresses" : "phones"  
              } 
            } 
          } 
        }, 
        "address" 
      ],
      "where": { "id": ownerId } 
    };
    ProductOwner.findOne(filter, options, function(err, result) {
      if(err) {
        return done(err);
      }
      let persOptions = {
        isBeforeRemote: false,
        context: options
      }
      performServicePersonalizations(ProductOwner.definition.name, result, persOptions, function(err){
        done(err, result);
      })
    });
  };
}
```

> Note: the `options` in the remote method function 
definition, in the example above is, `HttpContext`

### 2. Using model name, data, and, personalization rules

Use the `applyServicePersonalization()` api

Signature:
```js
/**
   * Api for personalization. Rules can
   * be manually passed as arguments to
   * this function.
   *
   * @param {string} modelName - the model name.
   * @param {*} data - object or array
   * @param {array} personalizationRecords - the personalization rule as an array.
   * @param {object} options - personalization options
   * @param {function} done - callback to signal completion. Takes only one argument - error.
   * @returns {undefined} - nothing
   */
  function applyServicePersonalization(modelName, data, personalizationRecords, options, done) {
    // ...
  }
```

## Significance of pre-fetch/post-fetch operations

It impacts how personalizations is done for relations, and, nested
data.

Operations are individual actions you can perform on data, such as 
**fieldMask**, or, **fieldValueReplace**, etc.

A `pre-fetch` operation is applied before data is fetched from 
a loopback datasource. For e.g. **lbFilter**, **filter**, etc

A `post-fetch` operation is carried out after data is fetched
from a loopback datasource. For e.g. **fieldMask**

Due to the way loopback relations are
implemented, only operations that `post-fetch` are honoured.
This is also the case when using the programmatic api
for service personalization (regardless of whether relations
are accessed or not).

## Points to consider

1. Datasource support. Datasources can be service-oriented.
(Such as a web service). 
Hence support for sorting, filtering, etc may be limited.
Therefore operations which pre-fetch may not give expected
results.

2. Using custom functions (`postCustomFunction` or `preCustomFunction`).
Please honour the pipeline stage and use the correct
operation. No point in trying to modify `ctx.result` in a
`preCustomFunction`. Also ensure path to the directory where
the custom functions are stored is configured correctly.

3. Understand how pre-fetch/post-fetch applies to relations and nested data. See section `Significance of pre-fetch/post-fetch operations`

4. See section `Notes on loopback relations`

## Test Synopsis

The following entity structure and relationships assumed for most of the tests.

```

+-------------------+      +------------------------+       +------------------------+
|                   |      |                        |       |                        |
|    AddressBook    |      |       PhoneNumber      |       |     ProductCatalog     |
|                   |      |                        |       |                        |
+-------------------+      +------------------------+       +------------------------+
| line1    : string |      | number    : string (PK)|       | name        : string   |
| line2    : string |      | firstName : string     |       | category    : string   |
| landmark : string |      | lastName  : string     |       | desc        : string   |
| pincode  : string |      |                        |       | price       : object   |
+-------------------+      +------------------------+       | isAvailable : boolean  |
                                                            | modelNo     : string   |
                                                            | keywords    : [string] |
                                                            +------------------------+


+-----------------+     +---------------+        +--------------------------------+
|                 |     |               |        |                                |
|  ProductOwner   |     |     Store     |        |           StoreStock           |
|                 |     |               |        |                                |
+-----------------+     +---------------+        +--------------------------------+
|  name : string  |     | name : string |        | storeId          : string (FK) |
|  city : string  |     |               |        | productCatalogId : string (FK) |
+-----------------+     +---------------+        +--------------------------------+


==========================================================================================================================

                                        +--------------+
                               +--------+ ProductOwner +----------+
                               +        +--------------+          +
                     (hasMany-ProductCatalog)             (hasOne-address)
                               +                                  +
                               v                                  v
                       +-------+--------+                    +----+----+                            +-------------+
         +------------>+ ProductCatalog |                    | Address +-----+(hasMany-phones)+---> | PhoneNumber |
         |             +----------------+                    +----+----+                            +-------------+
         |                                                        ^
         |                                                        |
(belongsTo-product)                                               +
         |                                                 (hasMany-addresses)
         |                                +-------+               +
         |         +-+(belongsTo-store)+->+ Store +---------------+
         |         |                      +-------+
         |         |
   +-----+------+  |
   | StoreStock +--+
   +------------+

```

Note: All the models have the `ServicePersonalizationMixin` enabled.

The `test` folder is meant to emulate a small oe-cloud application.

To run as an application server:

```
$ node test/server.js
```

It is also recommended to attach an explorer component (such as 
loopback-component-explorer) when running as a standalone application.

## Note on loopback relations

The standard names for instance methods
commonly refer to a loopback relation. The names
are governed by the loopback framework. The pattern
goes something like this:

E.g. consider a simple Customer/Order relationship.
Assume the following description of a `Customer`
model:

* `Customer`
  - relations
      - `orders`
        - type: `hasMany`
        - model: `Order`

Assumes a client invokes the following api (GET):
```
http://localhost:3000/api/Customers/2/orders
```
The loopback framework creates a `methodString` on the `HttpContext`
object as follows:
```
Customer.prototype.__get__orders
```

If the requirement is such that, only _this_ api call
should be personalized, _create a personalization record_ for `Order`

This should ensure the required result in the desired remote call.

> Note: both models should have `ServicePersonalizationMixin` enabled

A developer always has the freedom to define a non-static
instance method with the same name, and, still have the 
relation defined. One must always refrain from doing this.

Do not collude with loopback's 
internal naming standards.

