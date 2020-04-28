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

## dependency
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

## How to use

1. Install the module to your application

```
npm install oe-service-personalization
```
2. In your project's `app-list.json` file add the following config:

```
  {
    "path": "oe-service-personalization",
    "enabled": true,
    "autoEnableMixins": true
  }
```
3. Add `ServicePersonalizationMixin` mixin to the model declaration.

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
4. Insert rules into the `PersonalizationRule` model.

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
is always a simple key/value pair.

5. _(Optional)_ If there are some custom function based
operations, add the path in the application's `config.json`
file. Alternatively, set the environment variable: 
`custom_function_path`

Example: (`config.json` snippet):

```json
  "servicePersonalization" : {
    "customFunctionPath": "D:\\Repos\\oecloud.io\\oe-service-personalization_master\\test\\customFunction"
  }
```
Example: (via environment variable):
```bash
$ export custom_function_path="/project/customFuncDir"
```
> Note: the full path to the directory is required.

## Working Principle

During application startup all the models which have the 
above mixin applied will behave differently; we attach
`beforeRemote` and `afterRemote` hooks which determine if
there are personalization rules for the model, 
and, then finally performs
the defined operations on the request/response (as per the 
case). It also recursively does this in the case relational data
is included. The net effect of all the operations is the 
"personalized" data.

These steps personalize data as long as its accessed via a 
remote endpoint (aka _remotes_). To do this in code, please
see the programmatic api.

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
| lbFilter           | This applies a loopback filter  to the request; it can contain an _include_ clause or a _where_ clause.       | Pre-apply            | t21                                   |
| filter             | Same as above, but only adds the where clause to the request i.e.  a query-based filter                       | Pre-apply            | t9                                    |
| sort               | Performs a sort at the datasource level                                                                       | Pre-apply            | t4, t5, t6, t7, t8, t10, t11          |
| fieldReplace       | Replaces the property name in the data with another text. (Not its value)                                     | Pre-apply/Post-apply | t1, t15, t17                          |
| fieldValueReplace  | Replaces the property value in the data                                                                       | Pre-apply/Post-apply | t22, t20, t19, t18, t17, t16, t3, t23 |
| fieldMask          | Masks value in the field according to a regex pattern                                                         | Post-apply           | t24, t25, t26, t27, t28, t29          |
| mask               | Hides a field in the response                                                                                 | Pre-apply            | t13                                   |
| hide               | Same as _mask_                                                                                                | Pre-apply            | t13                                   |
| postCustomFunction | Adds a custom function which can add desired customization to response. Please see step #5 in how to use.     | Post-apply           | t35, t36                              |
| preCustomFunction  | Adds a custom function which can add desired customization to the request. Please see step  #5 in how to use. | Pre-apply            | t35, t36                              |

## Programmatic API

To do personalization in a custom remote method, or, in unit 
tests you need the following api.

```JavaScript

const { applyServicePersonalization } = require('oe-service-personalization/lib/service-personalizer');

// ...
var options = {
  isBeforeRemote: false, // required
  context: ctx //the http context
};

applyServicePersonalization(modelName, data, options, function(err){
  // nothing to access here since
  // data gets mutated internally
})
```

Example directly from our tests (test case `t41`): `./test/common/models/product-owner.js`

```javascript
const { applyServicePersonalization } = require('./../../../lib/service-personalizer'); // or require('oe-service-personalization/lib/service-personalizer');

module.exports = function(ProductOwner) {
  ProductOwner.remoteMethod('demandchain', {
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

  ProductOwner.demandchain = function(ownerId, options, done) {
    if(typeof done === 'undefined' && typeof options === 'function') {
      done = options;
      options = {};
    };

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
        done(err)
      }
      else {
        let persOpts = {
          isBeforeRemote: false, context: options
        };
        applyServicePersonalization('ProductOwner', result, persOpts, function(err){
          done(err, result);
        });
      }
    })
  };
}
```

## Pre-apply/Post-apply & Relations

All operations have two aspects. Some operations 
modify the context of the http request (for e.g.
`lbFilter`, `sort`, etc). Some operations modify the response (e.g. `fieldMask`)
we can access in an `afterRemote` phase of a request/response
pipeline. Other operations (for e.g. `fieldReplace`) have to 
take effect in both the stages.

Pre-apply/Post-apply is the vocabulary adopted to distinguish
these aspects of an operation - namely how and when it is 
applied in the request/response pipeline.

Due to the way loopback relations are
implemented only operations that post-apply are honoured.
This is also the case when using the programmatic api
for service personalization (regardless of whether relations
are accessed or not).

## Points to consider

1. Datasource support. Datasources can be service-oriented.
(Such as a web service). 
Hence support for sorting, filtering, etc may be limited.
Therefore operations which pre-apply may not give expected
results.

2. Using custom functions (`postCustomFunction` or `preCustomFunction`).
Please honour the pipeline stage and use the correct
operation. No point in trying to modify `ctx.result` in a
`preCustomFunction`. Also ensure path to the directory where
the custom functions are stored is configured correctly.

3. Pre-apply/post-apply and relations
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
