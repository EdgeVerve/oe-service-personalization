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

## Main features

- Customizing remote responses, or data 
(i.e. queried via loopback model api),
 to appear in a certain manner
  - Based on user role
  - Custom scope - for e.g. for android, or, ios clients
- Limiting personalization to apply to a particular remote method

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

All models with the `ServicePersonalizationMixin` 
enabled will have functions attached
to its `afterRemote()` and `beforeRemote()` which will
do the personalization.

The personalization records, stored in `PersonalizationRule`,
are queried according to scope, and, model participating, in
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
api call. They follow the same process mentioned above,
however, there are a few limitations. Notably, those 
operations which are meant to apply `post-fetch` will 
be honoured, and, thus personalized.

More details on `pre-fetch` and `post-fetch` in sections below. (Significance of pre-fetch & post-fetch)

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
the PersonalzationRule record.

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

## Programmatic API

To do personalization in a custom remote method, or, in unit 
tests you need the `performServicePersonalizations()` api.

Example

```JavaScript

const { performServicePersonalizations } = require('./../../../lib/service-personalizer'); // or require('oe-service-personalization/lib/service-personalizer');
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

3. Understand how pre-fetch/post-fetch applies to relations and nested data.
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
