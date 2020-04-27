# oe-service-personalization

This module will apply personalizations such as field masking, hiding fields, sorting, etc on top of traditional remote endpoints. With these limited set of operations it is also possible to personalize data to a group of clients. In other words, the same data can appear (and/or behave differently) on, say, an android app, an ios app, and, a browser app . Such granular segementations are possible by describing them in an property called `scope` on the personalization rule. (This is made possible by the `oe-personalization` module). Further, for such segmented personalizations to take effect, we need the necessary header in the http request (as how it is in the `scope`).

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

## Test Synopsis

The following entity structure and relationships assumed for most of the tests.

```

+-------------------+      +------------------------+       +------------------------+
|                   |      |                        |       |                        |
|    AddressBook    |      |       PhoneNumber      |       |     ProductCatalog     |
|                   |      |                        |       |                        |
+-------------------+      +------------------------+       +------------------------+
| line1    : string |      | number    : number (*) |       | name        : string   |
| line2    : string |      | firstName : string     |       | category    : string   |
| landmark : string |      | lastName  : string     |       | desc        : string   |
| pincode  : string |      |                        |       | price       : object   |
+-------------------+      +------------------------+       | isAvailable : boolean  |
                                                            | modelNo     : string   |
                                                            | keywords    : [string] |
                                                            +------------------------+


                      +-----------------+     +---------------+
                      |                 |     |               |
                      |  ProductOwner   |     |     Store     |
                      |                 |     |               |
                      +-----------------+     +---------------+
                      |  name : string  |     | name : string |
                      |  city : string  |     |               |
                      +-----------------+     +---------------+

=========================================================================================

                 +--------------+
        +--------+ ProductOwner +----------+
        |        +--------------+          |
     (hasMany)                         (hasOne)
        |                                  |
        v                                  v
+-------+--------+                    +----+----+                     +-------------+
| ProductCatalog |                    | Address +------(hasMany)----> | PhoneNumber |
+-------+--------+                    +----+----+                     +-------------+
        ^                                  ^
        |                                  |
    (hasMany)                              |
        |                              (hasMany)
        |          +-------+               |
        +--------->+ Store +---------------+
                   +-------+

```

Note: All the models have the `ServicePersonalizationMixin` enabled.