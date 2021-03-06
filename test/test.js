var oecloud = require('oe-cloud');
var loopback = require('loopback');
var async = require('async');
oecloud.boot(__dirname, function (err) {
  if (err) {
    console.log(err);
    process.exit(1);
  }
  oecloud.start();
  oecloud.emit('test-start');
});

var chalk = require('chalk');
var chai = require('chai');
chai.use(require('chai-things'));
var expect = chai.expect;
var _ = require('lodash');

var ProductCatalog;
var ProductOwner;
var PersonalizationRule;
var app = oecloud;
var defaults = require('superagent-defaults');
var supertest = require('supertest');

var api = defaults(supertest(app));
var basePath = app.get('restApiRoot');
var productCatalogUrl = basePath + '/ProductCatalogs';
var productOwnerUrl = basePath + '/ProductOwners';
describe(chalk.blue('service personalization test started...'), function () {
  // this.timeout(10000);
  var accessToken;
  before('wait for boot scripts to complete', function (done) {
    app.on('test-start', function () {
      // console.log('booted');
      ProductCatalog = loopback.findModel('ProductCatalog');
      ProductCatalog.destroyAll(function (err, info) {
        return done(err);
      });
    });
  });

  before('creating testUser', function (done) {
    var sendData = {
      'username': 'testuser',
      'password': 'testuser123',
      'email': 'test@testbear.com'
    };

    api
      .post('/api/Users')
      .send(sendData)
      .end(function (err, res) {
        if (err) {
          // log.error(err);

          return done(err);
        }
        // accessToken = res.body.id;
        return done();
      });
  });

  before('creating access token', function (done) {
    var sendData = {
      'username': 'testuser',
      'password': 'testuser123'
    };

    api
      .post('/api/Users/login')
      .send(sendData)
      .expect(200).end(function (err, res) {
        if (err) {
          // log.error(err);
          return done(err);
        }
        accessToken = res.body.id;
        return done();
      });
  });
  PersonalizationRule = loopback.findModel('PersonalizationRule');
  before('service personalization test - create test data', function (done) {
    // Populate some data.
    var item1 = {
      'name': 'king size bed',
      'category': 'furniture',
      'desc': 'king size bed',
      'price': {
        'value': 10000,
        'currency': 'inr'
      },
      'isAvailable': true,
      'productOwnerId': 1
    };
    var item2 = {
      'name': 'office chair',
      'category': 'furniture',
      'desc': 'office chair',
      'price': {
        'value': 5000,
        'currency': 'inr'
      },
      'isAvailable': true
    };
    var item3 = {
      'name': 'dinning table',
      'category': 'furniture',
      'desc': 'dinning table',
      'price': {
        'value': 8000,
        'currency': 'inr'
      },
      'isAvailable': false
    };
    var item11 = {
      'name': 'refrigerator',
      'category': 'electronics',
      'desc': 'refrigerator',
      'price': {
        'value': 10000,
        'currency': 'inr'
      },
      'isAvailable': true
    };
    var item22 = {
      'name': 'water heater',
      'category': 'electronics',
      'desc': 'water heater',
      'price': {
        'value': 5000,
        'currency': 'inr'
      },
      'isAvailable': true
    };
    var item33 = {
      'name': 'oven',
      'category': 'electronics',
      'desc': 'oven',
      'price': {
        'value': 8000,
        'currency': 'inr'
      },
      'isAvailable': false
    };
    ProductCatalog.create([item1, item2, item3, item11, item22, item33], function (err, results) {
      return done(err);
    });
  });

  afterEach('destroy context', function (done) {
    var callContext = {
      ctx: {
        'device': ['android', 'ios'],
        'tenantId': 'default'
      }
    };
    PersonalizationRule.destroyAll({}, callContext, function (err, result) {
      // console.log("Personalization Rule Model Removed : ", err, result);
      done();
    });
  });

  it('t1 should replace field names in response when fieldReplace personalization is configured', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldReplace': {
          'name': 'product name',
          'desc': 'product description'
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    PersonalizationRule.create(ruleForAndroid, function (err, rule) {
      if (err) {
        return done(new Error(err));
      }
      // var ruleId = rule.id;
      api.get(productCatalogUrl)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            done(err);
          }
          var results = resp.body;

          expect(results.length).to.be.equal(6);
          expect(results[0])
            .to.include.keys('product name', 'product description');
          expect(results[0])
            .to.not.include.keys('name', 'desc');
          done();
        });
    });
  });

  var owner1 = {
    'name': 'John',
    'city': 'Miami',
    'id': 1
  };

  var owner2 = {
    'name': 'Wick',
    'city': 'Texas',
    'id': 2
  };

  it('t2 create records in product owners', function (done) {
    ProductOwner = loopback.findModel('ProductOwner');
    ProductOwner.create(owner1, function (err) {
      if (err) {
        return done(err);
      }
      ProductOwner.create(owner2, function (err) {
        return done(err);
      });
    });
  });

  it('t3 should replace field names in response when fieldReplace personalization is configured', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldValueReplace': {
          'isAvailable': {
            true: 1,
            false: 0
          }
        }
      },
      'scope': {
        'device': 'android'
      }
    };
    PersonalizationRule.create(ruleForAndroid, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + `?access_token=${accessToken}`)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            done(err);
          }
          var results = resp.body;
          expect(results.length).to.be.equal(6);
          expect(results[0]).to.include.keys('isAvailable');
          expect(results[0].isAvailable).to.be.oneOf([0, 1]);
          done();
        });
    });
  });

  // sort test cases
  it('t4 single sort condition:  should return the sorted result when sort personalization rule is configured.', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'sort': {
          'name': 'asc'
        }
      },
      'scope': {
        'device': 'android'
      }
    };
    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].name).to.be.equal('dinning table');
          done();
        });
    });
  });

  it('t5 single sort condition: should sort in ascending order when the sort order is not specified', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'sort': {
          'name': ''
        }
      },
      'scope': {
        'device': 'android'
      }
    };


    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }


      api.get(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            return done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].name).to.be.equal('dinning table');
          done();
        });
    });
  });

  it('t6 single sort condition: should accept the keywords like asc,ascending,desc or descending as sort order', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'sort': {
          'name': 'descending'
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            return done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].name).to.be.equal('water heater');
          done();
        });
    });
  });

  it('t7 smultiple sort condition: should return sorted result when personalization rule with multiple sort is configured', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'sort': [{
          'category': 'asc'
        }, {
          'name': 'desc'
        }]
      },
      'scope': {
        'device': 'android'
      }
    };

    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            return done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].category).to.be.equal('electronics');
          expect(results[0].name).to.be.equal('water heater');
          done();
        });
    });
  });

  it('t8 multiple sort condition: should omit the sort expression whose order value(ASC|DSC) doesnt match the different cases', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'sort': [{
          'category': 'asc'
        }, {
          'name': 'abcd'
        }]
      },
      'scope': {
        'device': 'android'
      }
    };

    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            return done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].category).to.be.equal('electronics');
          expect(results[1].category).to.be.equal('electronics');
          expect(results[2].category).to.be.equal('electronics');
          expect(results[3].category).to.be.equal('furniture');
          expect(results[4].category).to.be.equal('furniture');
          expect(results[5].category).to.be.equal('furniture');
          done();
        });
    });
  });

  it('t9 sort and filter combined: should return filterd and sorted result when filter and sort personalization is configured', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'filter': {
          'category': 'furniture'
        },
        'sort': {
          'name': 'asc'
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            return done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(3);
          expect(results[0].category).to.be.equal('furniture');
          expect(results[0].name).to.be.equal('dinning table');
          done();
        });
    });
  });

  it('t10 multiple sort: should handle duplicate sort expressions', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'sort': {
          'name': 'asc'
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken + '&filter[order]=name ASC')
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            return done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].name).to.be.equal('dinning table');
          done();
        });
    });
  });

  it('t11 multiple sort: should handle clashing sort expressions.(Eg:name ASC in personalization rule and name DESC from API, in this case consider name DESC from API)',
    function (done) {
      // Setup personalization rule
      var ruleForAndroid = {
        'modelName': 'ProductCatalog',
        'personalizationRule': {
          'sort': {
            'name': 'asc'
          }
        },
        'scope': {
          'device': 'android'
        }
      };


      PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
        if (err) {
          return done(err);
        }
        api.get(productCatalogUrl + '?access_token=' + accessToken + '&filter[order]=name DESC')
          .set('Accept', 'application/json')
          .set('REMOTE_USER', 'testUser')
          .set('device', 'android')
          .expect(200).end(function (err, resp) {
            if (err) {
              return done(err);
            }
            var results = resp.body;
            expect(results).to.be.instanceof(Array);
            expect(results.length).to.equal(6);
            expect(results[0].name).to.be.equal('water heater');
            done();
          });
      });
    });
  // the below won't work in postgres or oracle. Since
  // JSON objects are not represented correctly for the
  // necessary operation to happen correctly. Hence the
  // exclusion.
  xit('t12 sort: should handle nested sorting', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'sort': {
          'price|value': 'asc'
        }
      },
      'scope': {
        'device': 'android'
      }
    };


    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        throw new Error(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android').expect(200).end(function (err, resp) {
          if (err) {
            done(err);
          }
          // console.log("==============", resp.body);
          var results = JSON.parse(resp.text);
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].name).to.be.equal('office chair');
          expect(results[0].price.value).to.be.equal(5000);
          done();
        });
    });
  });

  it('t13 Mask:should mask the given fields and not send them to the response', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'mask': {
          'category': true
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            return done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].category).to.be.equal(undefined);
          done();
        });
    });
  });

  it('t14 Mask:should mask the given fields and not send them to the response', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'mask': {
          'category': true
        }
      },
      'scope': {
        'device': 'android'
      }
    };


    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        return done(err);
      }
      api.get(productCatalogUrl + '?access_token=' + accessToken + '&filter[fields][name]=true')
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          if (err) {
            return done(err);
          }
          var results = resp.body;
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(6);
          expect(results[0].desc).to.be.equal(undefined);
          expect(results[0].category).to.be.equal(undefined);
          done();
        });
    });
  });

  it('t15 should replace field names while posting when fieldReplace personalization is configured', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldReplace': {
          'name': 'product name',
          'desc': 'product description'
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
      if (err) {
        throw new Error(err);
      }
      // var ruleId = rule.id;

      var postData = {
        'product name': 'o1ven',
        'product description': 'o1ven',
        'category': 'electronics',
        'price': {
          'value': 5000,
          'currency': 'inr'
        },
        'isAvailable': true
      };
      // console.log('accessToken:', accessToken);
      api.post(productCatalogUrl + `?access_token=${accessToken}`)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .send(postData)
        .expect(200).end(function (err, resp) {
          if (err) {
            done(err);
          } else {
            var results = JSON.parse(resp.text);
            expect(results)
              .to.include.keys('product name', 'product description');
            done();
          }
        });
    });
  });

  // TODO: (Arun - 2020-04-24 22:34:58) Is it meant to demonstrate reverse field value replace?
  it('t16 should replace field value names while posting when fieldValueReplace personalization is configured',
    function (done) {
      // Setup personalization rule
      var ruleForAndroid = {
        'modelName': 'ProductCatalog',
        'personalizationRule': {
          'fieldValueReplace': {
            'name': {
              'oven': 'new oven'
            }
          }
        },
        'scope': {
          'device': 'android'
        }
      };

      PersonalizationRule.create(ruleForAndroid, {}, function (err, rule) {
        if (err) {
          throw new Error(err);
        }
        // var ruleId = rule.id;

        var postData = {
          'name': 'new oven',
          'desc': 'oven',
          'category': 'electronics',
          'price': {
            'value': 5000,
            'currency': 'inr'
          },
          'isAvailable': true
        };

        api.post(productCatalogUrl + '?access_token=' + accessToken)
          .set('Accept', 'application/json')
          .set('REMOTE_USER', 'testUser')
          .set('device', 'android')
          .send(postData)
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            } else {
              var results = JSON.parse(resp.text);
              expect(results.name).to.be.equal('new oven');
              done();
            }
          });
      });
    });


  it('t17 should replace field names and field value names when scope of personalization rule matches', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldReplace': {
          'name': 'product_name_android',
          'desc': 'product_description_android'
        },
        'fieldValueReplace': {
          'name': {
            'oven': 'new_oven_android'
          }
        }

      },
      'scope': {
        'device': 'android'
      }
    };

    // var ruleForIos = {
    //   'modelName': 'ProductCatalog',
    //   'personalizationRule': {
    //     'fieldReplace': {
    //       'name': 'product_name_ios',
    //       'desc': 'product_description_ios'
    //     },
    //     'fieldValueReplace': {
    //       'name': {
    //         'oven': 'new_oven_ios'
    //       }
    //     }
    //   },
    //   'scope': {
    //     'device': 'ios'
    //   }
    // };

    var ruleForIos = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {

        'fieldValueReplace': {
          'name': {
            'oven': 'new_oven_ios'
          }
        },
        'fieldReplace': {
          'name': 'product_name_ios',
          'desc': 'product_description_ios'
        }
      },
      'scope': {
        'device': 'ios'
      }
    };
    var personalizationRuleArray = [ruleForAndroid, ruleForIos];

    PersonalizationRule.create(personalizationRuleArray, {}, function (err, rules) {
      if (err) {
        throw new Error(err);
      }

      var postData = {
        'name': 'oven',
        'desc': 'oven',
        'category': 'electronics',
        'price': {
          'value': 5000,
          'currency': 'inr'
        },
        'isAvailable': true
      };

      api.post(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        // .set('TENANT_ID', tenantId)
        .set('REMOTE_USER', 'testUser')
        .set('device', 'ios')
        .send(postData)
        .expect(200).end(function (err, resp) {
          if (err) {
            throw new Error(err);
          }

          var results = JSON.parse(resp.text);
          expect(results)
            .to.include.keys('product_name_ios', 'product_description_ios');
          expect(results.product_name_ios).to.be.equal('new_oven_ios');
          api.post(productCatalogUrl + '?access_token=' + accessToken)
            .set('Accept', 'application/json')
            // .set('TENANT_ID', tenantId)
            .set('REMOTE_USER', 'testUser')
            .set('device', 'ios')
            .send(postData)
            .expect(200).end(function (err, resp) {
              if (err) {
                throw new Error(err);
              }

              var results = JSON.parse(resp.text);
              expect(results)
                .to.include.keys('product_name_ios', 'product_description_ios');
              expect(results.product_name_ios).to.be.equal('new_oven_ios');
              done();
            });
        });
    });
  });

  // Nested input values
  it('t18 (Nested input) should replace field names and field	value names when scope of personalization rule matches while posting', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {

        'fieldValueReplace': {
          'name': {
            'oven': 'new_oven_android'
          },
          'price\uFF0Ecurrency': {
            'inr': 'IndianRupee'
          }
        },
        'fieldReplace': {
          'price\uFF0Ecurrency': 'price_currency',
          'name': 'product_name_android',
          'desc': 'product_description_android'
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    var personalizationRule = ruleForAndroid;

    PersonalizationRule.create(personalizationRule, {}, function (err, rules) {
      var postData = {
        'name': 'oven',
        'desc': 'oven',
        'category': 'electronics',
        'price': {
          'value': 5000,
          'currency': 'inr'
        },
        'isAvailable': true,
        'id': '9898'
      };

      if (err) {
        throw new Error(err);
      }

      api.post(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        // .set('TENANT_ID', tenantId)
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .send(postData)
        .expect(200).end(function (err, resp) {
          if (err) {
            throw new Error(err);
          }

          var results = JSON.parse(resp.text);

          expect(results.price).keys('price_currency', 'value');
          expect(results).to.include.keys('product_name_android', 'product_description_android');
          expect(results.product_name_android).to.be.equal('new_oven_android');
          expect(results.price.price_currency).to.be.equal('IndianRupee');
          done();
        });
    });
  });


  it('t19 (Nested input) should replace field names and field value names when scope of personalization rule matches while getting', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldValueReplace': {
          'name': {
            'oven': 'new_oven_android'
          },
          'price\uFF0Ecurrency': {
            'inr': 'IndianRupee'
          }
        },
        'fieldReplace': {
          'price\uFF0Ecurrency': 'price_currency',
          'name': 'product_name_android',
          'desc': 'product_description_android'
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    var personalizationRule = ruleForAndroid;

    PersonalizationRule.create(personalizationRule, {}, function (err, rules) {
      if (err) {
        throw new Error(err);
      }

      api.get(productCatalogUrl + '?access_token=' + accessToken).set('Accept', 'application/json')
        // .set('TENANT_ID', tenantId)
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          var results = JSON.parse(resp.text);
          var result = results.filter(function (obj) {
            if (obj.id === '9898') {
              return true;
            }
            return false;
          });
          expect(result[0].price).keys('price_currency', 'value');
          expect(result[0]).to.include.keys('product_name_android', 'product_description_android');
          expect(result[0].product_name_android).to.be.equal('new_oven_android');
          expect(result[0].price.price_currency).to.be.equal('IndianRupee');
          done();
        });
    });
  });


  it('t20 (Nested input) should not replace field names and field value names when scope of personalization rule not matches while getting the data', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldReplace': {
          'price\uFF0Ecurrency': 'price_currency',
          'name': 'product_name_android',
          'desc': 'product_description_android'
        },
        'fieldValueReplace': {
          'name': {
            'oven': 'new_oven_android'
          },
          'price\uFF0Ecurrency': {
            'inr': 'IndianRupee'
          }
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    var personalizationRule = ruleForAndroid;

    PersonalizationRule.create(personalizationRule, {}, function (err, rules) {
      if (err) {
        throw new Error(err);
      }

      api.get(productCatalogUrl + '?access_token=' + accessToken).set('Accept', 'application/json')
        // .set('TENANT_ID', tenantId)
        .set('REMOTE_USER', 'testUser')
        .set('device', 'ios')
        .expect(200).end(function (err, resp) {
          var results = JSON.parse(resp.text);
          var result = results.filter(function (obj) {
            if (obj.id === '9898') {
              return true;
            }
            return false;
          });
          expect(result[0].price).keys('currency', 'value');
          expect(result[0]).to.include.keys('category', 'price', 'isAvailable', 'id', 'name', 'desc');
          expect(result[0].name).to.be.equal('oven');
          expect(result[0].price.currency).to.be.equal('inr');
          done();
        });
    });
  });

  //TODO: (Arun 2020-04-24 22:40:29) - lbFilter should it be there in the first place?
  it('t21 should give filterd result when lbFilter is applied', function (done) {
    // Setup personalization rule
    var ruleForAndroid = {
      'modelName': 'ProductOwner',
      'personalizationRule': {
        'lbFilter': {
          'include': 'ProductCatalog',
          'where': {
            'name': 'John'
          }
        }
      },
      'scope': {
        'device': 'android'
      }
    };

    var personalizationRule = ruleForAndroid;

    PersonalizationRule.create(personalizationRule, {}, function (err, rules) {
      if (err) {
        throw new Error(err);
      }
      api.get(productOwnerUrl + '?access_token=' + accessToken).set('Accept', 'application/json')
        // .set('TENANT_ID', tenantId)
        .set('REMOTE_USER', 'testUser')
        .set('device', 'android')
        .expect(200).end(function (err, resp) {
          var results = JSON.parse(resp.text);
          expect(results).to.have.length(1);
          expect(results[0]).to.include.keys('ProductCatalog');
          expect(results[0].ProductCatalog).to.have.length(1);
          done();
        });
    });
  });

  it('t22 should replace field value names array datatype while posting when fieldValueReplace personalization is configured', function (done) {
    // Setup personalization rule
    var ruleForMobile = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldValueReplace': {
          'keywords': {
            'Alpha': 'A',
            'Bravo': 'B'
          }
        }
      },
      'scope': {
        'device': 'mobile'
      }
    };

    PersonalizationRule.create(ruleForMobile, {}, function (err, rule) {
      if (err) {
        done(err);
      } else {
        var postData = {
          'name': 'Smart Watch',
          'desc': 'Smart watch with activity tracker',
          'category': 'electronics',
          'price': {
            'value': 5000,
            'currency': 'inr'
          },
          'keywords': ['Alpha', 'Bravo', 'Charlie', 'Delta'],
          'isAvailable': true,
          'id': 'watch1'
        };

        api.post(productCatalogUrl + '?access_token=' + accessToken)
          .set('Accept', 'application/json')
          // .set('TENANT_ID', tenantId)
          .set('REMOTE_USER', 'testUser')
          .set('device', 'mobile')
          .send(postData)
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            } else {
              var result = resp.body;
              expect(result.name).to.be.equal('Smart Watch');
              expect(result.keywords).to.be.an('array');
              expect(result.keywords).to.have.length(4);
              expect(result.keywords).to.include.members(['A', 'B', 'Charlie', 'Delta']);
              done();
            }
          });
      }
    });
  });

  it('t23 should replace field values on array datatype in response when fieldValueReplace personalization is configured ', function (done) {
    // Setup personalization rule
    var productWithId = productCatalogUrl + '/watch1';
    api.get(productWithId + '?access_token=' + accessToken)
      .set('Accept', 'application/json')
      // .set('TENANT_ID', tenantId)
      .set('REMOTE_USER', 'testUser')
      .set('DEVICE', 'mobile')
      .expect(200).end(function (err, resp) {
        if (err) {
          done(err);
        }
        var result = resp.body;
        expect(result.name).to.be.equal('Smart Watch');
        expect(result.keywords).to.be.an('array');
        expect(result.keywords).to.have.length(4);
        expect(result.keywords).to.include.members(['A', 'B', 'Charlie', 'Delta']);
        done();
      });
  });

  it('t24 should be able to create a fieldMask personalization rule, post data and get response in specific format', function (done) {
    // Setup personalization rule
    var ruleForMobile = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldMask': {
          'modelNo': {
            'pattern': '([0-9]{3})([0-9]{3})([0-9]{4})',
            'maskCharacter': 'X',
            'format': '($1) $2-$3',
            'mask': ['$3']
          }
        }
      },
      'scope': {
        'region': 'us'
      }
    };

    PersonalizationRule.create(ruleForMobile, {}, function (err, rule) {
      if (err) {
        done(err);
      } else {
        var postData = {
          'name': 'Omnitrix',
          'desc': 'Alien tech smart watch allows to transform into .... nah nothing, just a smart watch',
          'category': 'electronics',
          'price': {
            'value': 89000,
            'currency': 'inr'
          },
          'keywords': ['Alpha', 'Bravo'],
          'isAvailable': true,
          'id': 'watch2',
          'modelNo': '1233567891'
        };

        api.post(productCatalogUrl + '?access_token=' + accessToken)
          .set('Accept', 'application/json')
          // .set('TENANT_ID', tenantId)
          .set('REMOTE_USER', 'testUser')
          .set('region', 'us')
          .send(postData)
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            } else {
              var result = resp.body;
              expect(result).not.to.be.null;
              expect(result).not.to.be.empty;
              expect(result).not.to.be.undefined;
              expect(result.modelNo).to.be.equal('(123) 356-XXXX');
              done();
            }
          });
      }
    });
  });

  it('t25 should get result in specific format on get when fieldMask personalization rule is applied', function (done) {
    // Setup personalization rule
    var productWithId = productCatalogUrl + '/watch2';
    api.get(productWithId + '?access_token=' + accessToken)
      .set('Accept', 'application/json')
      // .set('TENANT_ID', tenantId)
      .set('REMOTE_USER', 'testUser')
      .set('region', 'us')
      .expect(200).end(function (err, resp) {
        if (err) {
          done(err);
        }
        var result = resp.body;
        expect(result).not.to.be.null;
        expect(result).not.to.be.empty;
        expect(result).not.to.be.undefined;
        expect(result.modelNo).to.be.equal('(123) 356-XXXX');
        done();
      });
  });

  it('t26 should be able to create a fieldMask personalization rule, post data and get response in specific format', function (done) {
    // Setup personalization rule
    var ruleForMobile = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldMask': {
          'modelNo': {
            'pattern': '([0-9]{5})([0-9]{1})([0-9]{4})',
            'maskCharacter': '-',
            'format': '+91 $1 $2$3',
            'mask': ['$3']
          }
        }
      },
      'scope': {
        'region': 'in'
      }
    };

    PersonalizationRule.create(ruleForMobile, {}, function (err, rule) {
      if (err) {
        done(err);
      } else {
        var postData = {
          'name': 'MultiTrix',
          'desc': 'There is no such smart watch',
          'category': 'electronics',
          'price': {
            'value': 23400,
            'currency': 'inr'
          },
          'keywords': ['Charlie', 'India'],
          'isAvailable': true,
          'id': 'watch3',
          'modelNo': '9080706050'
        };

        api.post(productCatalogUrl + '?access_token=' + accessToken)
          .set('Accept', 'application/json')
          // .set('TENANT_ID', tenantId)
          .set('REMOTE_USER', 'testUser')
          .set('region', 'in')
          .send(postData)
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            } else {
              var result = resp.body;
              expect(result).not.to.be.null;
              expect(result).not.to.be.empty;
              expect(result).not.to.be.undefined;
              expect(result.modelNo).to.be.equal('+91 90807 0----');
              done();
            }
          });
      }
    });
  });

  it('t27 should get result in specific format on get when fieldMask personalization rule is applied', function (done) {
    // Setup personalization rule
    var productWithId = productCatalogUrl + '/watch3';
    api.get(productWithId + '?access_token=' + accessToken)
      .set('Accept', 'application/json')
      // .set('TENANT_ID', tenantId)
      .set('REMOTE_USER', 'testUser')
      .set('region', 'in')
      .expect(200).end(function (err, resp) {
        if (err) {
          done(err);
        }
        var result = resp.body;
        expect(result).not.to.be.null;
        expect(result).not.to.be.empty;
        expect(result).not.to.be.undefined;
        expect(result.modelNo).to.be.equal('+91 90807 0----');
        done();
      });
  });

  it('t28 should get result in specific format on get when fieldMask personalization rule is applied no masking', function (done) {
    // Setup personalization rule
    var ruleForMobile = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldMask': {
          'modelNo': {
            'pattern': '([0-9]{5})([0-9]{1})([0-9]{4})',
            'maskCharacter': 'X',
            'format': '+91 $1 $2$3'
          }
        }
      },
      'scope': {
        'region': 'ka'
      }
    };

    PersonalizationRule.create(ruleForMobile, {}, function (err, rule) {
      if (err) {
        done(err);
      } else {
        var productWithId = productCatalogUrl + '/watch3';
        api.get(productWithId + '?access_token=' + accessToken)
          .set('Accept', 'application/json')
          // .set('TENANT_ID', tenantId)
          .set('REMOTE_USER', 'testUser')
          .set('region', 'ka')
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            } else {
              var result = resp.body;
              expect(result).not.to.be.null;
              expect(result).not.to.be.empty;
              expect(result).not.to.be.undefined;
              expect(result.modelNo).to.be.equal('+91 90807 06050');
              done();
            }
          });
      }
    });
  });

  it('t29 should get result on get when fieldMask personalization rule is applied and no format is given', function (done) {
    // Setup personalization rule
    var ruleForMobile = {
      'modelName': 'ProductCatalog',
      'personalizationRule': {
        'fieldMask': {
          'modelNo': {
            'pattern': '([0-9]{5})([0-9]{1})([0-9]{4})',
            'maskCharacter': 'X',
            'mask': ['$3']
          }
        }
      },
      'scope': {
        'region': 'kl'
      }
    };

    PersonalizationRule.create(ruleForMobile, {}, function (err, rule) {
      if (err) {
        done(err);
      } else {
        var productWithId = productCatalogUrl + '/watch3';
        api.get(productWithId + '?access_token=' + accessToken)
          .set('Accept', 'application/json')
          // .set('TENANT_ID', tenantId)
          .set('REMOTE_USER', 'testUser')
          .set('region', 'kl')
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            } else {
              var result = resp.body;
              expect(result).not.to.be.null;
              expect(result).not.to.be.empty;
              expect(result).not.to.be.undefined;
              expect(result.modelNo).to.be.equal('908070XXXX');
              done();
            }
          });
      }
    });
  });

  describe('DOT Tests - ', function () {
    var AddressModel, CustomerModel;
    var defContext = {};
    before('setup test data', done => {
      var ModelDefinition = loopback.findModel('ModelDefinition');

      var AddressModelSpec = {
        name: 'Address',
        properties: {
          street: {
            type: 'string'
          },
          city: {
            type: 'string'
          },
          state: {
            type: 'string'
          }
        },
        mixins: {
          ServicePersonalizationMixin: true
        }
      };

      var CustomerModelSpec = {
        name: 'Customer',
        properties: {
          name: 'string',
          age: 'number'
        },
        relations: {
          address: {
            type: 'embedsOne',
            model: 'Address',
            property: 'billingAddress'
          }
        },
        mixins: {
          ServicePersonalizationMixin: true
        }
      };

      ModelDefinition.create([CustomerModelSpec, AddressModelSpec], defContext, function (err, data) {
        if (err) {
          done(err);
        } else {
          AddressModel = loopback.getModel('Address', defContext);
          CustomerModel = loopback.getModel('Customer', defContext);
          expect(AddressModel).to.not.be.undefined;
          expect(CustomerModel).to.not.be.undefined;
          done();
        }
      });
    });

    before('setup data', function (done) {
      var customerData = [
        {
          'name': 'jenny',
          'age': 23,
          'billingAddress': {
            'city': 'bangalore',
            'state': 'Karnataka',
            'street': 'HSR'
          }
        },

        {
          'name': 'John',
          'age': 50,
          'billingAddress': {
            'city': 'blore',
            'state': 'KTK',
            'street': 'BTM'
          }
        },
        {
          'name': 'Jack',
          'age': 50,
          'billingAddress': {
            'city': 'blore',
            'state': 'KTK',
            'street': 'Ecity'
          }
        }
      ];
      CustomerModel.create(customerData, {}, function (err) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
    });

    afterEach('destroy context', function (done) {
      var callContext = {
        ctx: {
          'device': ['android']
        }
      };
      PersonalizationRule.destroyAll({}, callContext, function (err, result) {
        // console.log("Model Removed : ", result.count);
        done();
      });
    });

    it('t31 should replace field names in response data when fieldReplace personalization rule is configured', done => {
      var ruleForAndroid = {
        'modelName': 'Customer',
        'personalizationRule': {
          'fieldReplace': {
            'billingAddress\uFF0Estreet': 'lane'
          }
        },
        'scope': {
          'device': 'android'
        }
      };

      PersonalizationRule.create(ruleForAndroid, {}, function (err) {
        if (err) {
          return done(err);
        }
        api.get('/api/Customers')
          .set('Accept', 'application/json')
          .set('device', 'android')
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            }
            var results = resp.body;
            expect(results.length).to.be.equal(3);
            // expect(results[0], 'doesn\'t have the field').to.have.key('billingAddress');
            expect('billingAddress' in results[0]).to.be.true;
            expect(results[0].billingAddress).keys('city', 'state', 'lane');
            expect(results[0]).to.include.keys('name', 'age', 'billingAddress', 'id');
            done();
          });
      });
    });

    it('t32 should sort the results based on sort expression', done => {
      var ruleForAndroid = {
        'modelName': 'Customer',
        'personalizationRule': {
          'sort': {
            'billingAddress|street': 'asc'
          }
        },
        'scope': {
          'device': 'android'
        }
      };

      PersonalizationRule.create(ruleForAndroid, defContext, function (err, rule) {
        if (err) {
          throw new Error(err);
        }

        api.get('/api/Customers')
          .set('Accept', 'application/json')
          .set('device', 'android')
          .expect(200)
          .end(function (err, resp) {
            if (err) {
              return done(err);
            }
            var results = resp.body;
            expect(results).to.be.instanceof(Array);
            expect(results.length).to.equal(3);
            expect(results[0].billingAddress.street).to.be.equal('BTM');
            expect(results[1].billingAddress.street).to.be.equal('Ecity');
            expect(results[2].billingAddress.street).to.be.equal('HSR');
            done();
          });
      });
    });
  });

  describe('CustomFunction Tests - ', function () {
    it('t33 apply customFunction for non-existence model', function (done) {
      // Setup personalization rule
      var ruleForAndroid = {
        'modelName': 'ProductCatalog123456',
        'personalizationRule': {
          'postCustomFunction': {
            'functionName': 'customFn'
          }
        },
        'scope': {
          'device': 'android'
        }
      };

      PersonalizationRule.create(ruleForAndroid, function (err, rule) {
        if (err) {
          return done();
        }
        return done(new Error('Model doesn\'t exist, but still PersonalizationRule created'));
      });
    });

    it('t34 apply customFunction personalizationRule for non-existence function', function (done) {
      // Setup personalization rule
      var ruleForAndroid = {
        'modelName': 'ProductCatalog',
        'personalizationRule': {
          'postCustomFunction': {
            'functionName': 'customFn123'
          }
        },
        'scope': {
          'device': 'android'
        }
      };

      PersonalizationRule.create(ruleForAndroid, function (err, rule) {
        if (err) {
          return done();
        }
        return done(new Error('Function doesn\'t exist, but still PersonalizationRule created'));
      });
    });

    it('t35 apply postCustomFunction for get request', function (done) {
      // Setup personalization rule
      var ruleForAndroid = {
        'modelName': 'ProductCatalog',
        'personalizationRule': {
          'postCustomFunction': {
            'functionName': 'customFn'
          }
        },
        'scope': {
          'device': 'android'
        }
      };

      PersonalizationRule.create(ruleForAndroid, function (err, rule) {
        if (err) {
          return done(new Error(err));
        }
        // var ruleId = rule.id;
        api.get(productCatalogUrl)
          .set('Accept', 'application/json')
          .set('REMOTE_USER', 'testUser')
          .set('device', 'android')
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            }
            done();
          });
      });
    });

    it('t36 apply postCustomFunction for post request', function (done) {
      // Setup personalization rule
      var ruleForAndroid = {
        'modelName': 'ProductCatalog',
        'personalizationRule': {
          'preCustomFunction': {
            'functionName': 'hashReqBody'
          }
        },
        'scope': {
          'device': 'android'
        }
      };
      PersonalizationRule.create(ruleForAndroid, function (err, rule) {
        if (err) {
          return done(new Error(err));
        }
        var postData = {
          'name': 'customOven',
          'desc': 'Customeized oven',
          'category': 'electronics',
          'price': {
            'value': 10000,
            'currency': 'inr'
          },
          'isAvailable': true
        };

        api.post(productCatalogUrl + `?access_token=${accessToken}`)
          .set('Accept', 'application/json')
          .set('REMOTE_USER', 'testUser')
          .set('device', 'android')
          .send(postData)
          .expect(200).end(function (err, resp) {
            if (err) {
              done(err);
            } else {
              var result = JSON.parse(resp.text);
              expect(result.name).to.not.equal(postData.name);
              done();
            }
          });
      });
    });
  });

  describe('Updation scenarios', function () {
    it('t37 should apply personalization during an upsert for the same scope', function (done) {
      let putData = {
        id: 'watch3',
        name: 'MultiTrix - MODEL 1100',
        modelNo: '7983211100'
      };

      api.put(productCatalogUrl + '?access_token=' + accessToken)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('region', 'kl')
        .send(putData)
        .expect(200)
        .end(function (err, resp) {
          if (err) {
            done(err)
          }
          else {
            var result = resp.body;
            expect(result.id).to.equal(putData.id);
            expect(result.name).to.equal(putData.name);
            expect(result.modelNo).to.equal('798321XXXX');
            done();
          }
        })
    });

    it('t38 should apply personalization to a single record that is being updated', function (done) {
      let putData = {
        modelNo: '1234560000'
      };

      let apiUrl = productCatalogUrl + '/watch3' + `?access_token=${accessToken}`;
      api.put(apiUrl)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('region', 'kl')
        .send(putData)
        .expect(200)
        .end(function (err, resp) {
          if (err) {
            done(err)
          }
          else {
            let result = resp.body;
            expect(result.id).to.equal('watch3');
            expect(result.modelNo).to.equal('123456XXXX');
            done();
          }
        })
    });
  });

  var httpResult;

  describe('Relation tests', function () {

    before('creating the product owner', done => {
      let data = {
        "name": "Swamy Patanjali",
        "city": "Lucknow",
        "id": 12
      };
      ProductOwner = loopback.findModel('ProductOwner');
      ProductOwner.create(data, function (err) {
        done(err);
      });
    });

    before('creating a catalog', done => {
      let data = [
        {
          "name": "Patanjali Paste",
          "category": "FMCG",
          "desc": "Herbal paste that is all vegan",
          "price": { "currency": "INR", "amount": 45 },
          "isAvailable": false,
          "keywords": ["toothpaste", "herbal"],
          "productOwnerId": 12,
          "id": "prod1"
        },
        {
          "name": "Patanjali Facial",
          "category": "Cosmetics",
          "desc": "Ayurvedic cream to get rid of dark spots, pimples, etc",
          "price": { "currency": "INR", "amount": 70 },
          "isAvailable": true,
          "keywords": ["face", "herbal", "cream"],
          "productOwnerId": 12,
          "id": "prod2"
        }
      ];

      ProductCatalog.create(data, function (err) {
        done(err);
      });
    });

    before('creating stores', done => {
      let data = [
        {
          "name": "Patanjali Store 1",
          "id": "store2"
        },
        {
          "name": "Patanjali Store 2",
          "id": "store1"
        }
      ];
      let Store = loopback.findModel('Store');
      Store.create(data, function (err) {
        done(err);
      });
    });

    before('creating store stock', done => {
      let data = [
        { "storeId": "store1", "productCatalogId": "prod1" },
        { "storeId": "store2", "productCatalogId": "prod2" }
      ];
      let StoreStock = loopback.findModel('StoreStock');
      StoreStock.create(data, function (err) {
        done(err);
      });
    });

    before('create addresses', done => {
      let data = [
        {
          "line1": "5th ave",
          "line2": "Richmond",
          "landmark": "Siegel Building",
          "pincode": "434532",
          "id": "addr1",
          "storeId": "store1"
        },
        {
          "line1": "7th ave",
          "line2": "Wellington Broadway",
          "landmark": "Carl Sagan's Office",
          "pincode": "434543",
          "id": "addr2",
          "storeId": "store1"
        },
        {
          "line1": "Patanjali Lane",
          "line2": "Patanjali Rd",
          "landmark": "Near locality water tank",
          "pincode": "473032",
          "id": "addr3",
          "productOwnerId": 12
        },
        {
          "line1": "Orchard St",
          "line2": "Blumingdale's",
          "landmark": "Post Office",
          "pincode": "673627",
          "id": "addr4",
          "storeId": "store2"
        }
      ];
      let AddressBook = loopback.findModel('AddressBook');
      AddressBook.create(data, function (err) {
        done(err);
      });
    });

    before('creating phone numbers', done => {
      let data = [
        {
          "number": "2342229898",
          "firstName": "Ethan",
          "lastName": "Hunt",
          "addressBookId": "addr1"
        },
        {
          "number": "2342229899",
          "firstName": "Davy",
          "lastName": "Jones",
          "addressBookId": "addr1"
        },
        {
          "number": "2342222399",
          "firstName": "Jack",
          "lastName": "Sparrow",
          "addressBookId": "addr2"
        },
        {
          "number": "8037894565",
          "firstName": "Martha",
          "lastName": "James",
          "addressBookId": "addr3"
        },
        {
          "number": "2340022399",
          "firstName": "Antonio",
          "lastName": "Bandaras",
          "addressBookId": "addr4"
        },
      ];

      let PhoneNumber = loopback.findModel('PhoneNumber');
      PhoneNumber.create(data, function (err) {
        done(err);
      });
    });



    it('t39 should apply child model personalization when included from parent with no personalization', done => {
      let data = {
        productOwnerId: 1
      };

      let url = `${productCatalogUrl}/watch3?access_token=${accessToken}`;
      api.put(url)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('region', 'kl')
        .send(data)
        .expect(200)
        .end((err, resp) => {
          if (err) {
            done(err)
          }
          else {
            let filter = { include: ["ProductCatalog"] };
            let escapedFilter = encodeURIComponent(JSON.stringify(filter));
            let url2 = `${productOwnerUrl}/1?filter=${escapedFilter}&access_token=${accessToken}`;
            let res = resp.body;
            expect(res.modelNo).to.include("XXXX");
            api.get(url2)
              .set('Accept', 'application/json')
              .set('REMOTE_USER', 'testUser')
              .set('region', 'kl')
              .expect(200).end((err, resp) => {
                if (err) {
                  done(err);
                }
                else {
                  let result = resp.body;
                  expect(result.ProductCatalog).to.be.array;
                  let watch3item = result.ProductCatalog.find(item => item.id === 'watch3');
                  expect(watch3item.modelNo).to.equal('123456XXXX');
                  done();
                }
              });
          }
        });
    });

    it('t40(a) should demonstrate personalization is being applied recursively', done => {
      let data = [
        {
          "modelName": "AddressBook",
          "personalizationRule": {
            "mask": {
              "landmark": true
            }
          }
        },
        {
          "modelName": "PhoneNumber",
          "personalizationRule": {
            "fieldMask": {
              "number": {
                "pattern": "([0-9]{3})([0-9]{3})([0-9]{4})",
                "maskCharacter": "X",
                "format": "($1) $2-$3",
                "mask": ["$1", "$2"]
              }
            }
          }
        }
      ];

      PersonalizationRule.create(data, {}, function (err) {
        if (err) {
          return done(err)
        }
        let filter = {
          "include": [
            {
              "ProductCatalog": {
                "store": {
                  "store": {
                    "addresses": "phones"
                  }
                }
              }
            },
            "address"
          ],
          "where": { "id": 12 }
        };
        let filterString = encodeURIComponent(JSON.stringify(filter));
        let url = `${productOwnerUrl}/findOne?access_token=${accessToken}&&filter=${filterString}`;
        api.get(url)
          .set('Accept', 'application/json')
          .set('REMOTE_USER', 'testUser')
          .expect(200)
          .end((err, resp) => {
            if (err) {
              done(err)
            }
            else {
              let result = resp.body;
              httpResult = result;
              expect(result.ProductCatalog).to.be.array;
              expect(result.address).to.be.object;
              // console.log(JSON.stringify(result,null, 2));
              _.flatten(
                _.flatten(result.ProductCatalog.map(item => item.store.store.addresses))
                  .map(x => x.phones)
              ).forEach(ph => {
                let substr = ph.number.substr(0, 10);
                expect(substr).to.equal('(XXX) XXX-');
              });


              done();
            }
          });
      });
    });

    it('t40(b) should apply service personalization to a related model invoked via remote call', function (done) {
      let url = `${productOwnerUrl}/1/ProductCatalog?access_token=${accessToken}`;
      api.get(url)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .set('region', 'kl')
        .expect(200)
        .end((err, resp) => {
          if (err) {
            return done(err);
          }
          let result = resp.body;
          // console.log(resp.body);
          let idx = result.findIndex(r => r.id === 'watch3');
          expect(result[idx].modelNo).to.equal('123456XXXX');
          done();
        });
    });
  });

  describe('Remote method tests', () => {
    beforeEach('re-inserting the personalization rules', done => {
      let data = [
        {
          "modelName": "AddressBook",
          "personalizationRule": {
            "mask": {
              "landmark": true
            }
          }
        },
        {
          "modelName": "PhoneNumber",
          "personalizationRule": {
            "fieldMask": {
              "number": {
                "pattern": "([0-9]{3})([0-9]{3})([0-9]{4})",
                "maskCharacter": "X",
                "format": "($1) $2-$3",
                "mask": ["$1", "$2"]
              }
            }
          }
        }
      ]

      PersonalizationRule.create(data, {}, function (err) {
        done(err);
      });
    });

    it('t41(a) should demonstrate data getting personalized via a custom remote method of model that has mixin enabled', done => {

      let ownerId = 12;
      let url = `${productOwnerUrl}/${ownerId}/demandchain?access_token=${accessToken}`;
      api.get(url)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .expect(200)
        .end((err, resp) => {
          if (err) {
            done(err);
          }
          else {
            let result = resp.body;
            expect(result).to.deep.equal(httpResult);
            done();
          }
        })
    });

    it('t41(b) should personalize the response of a custom remote method of model that does not have mixin enabled (api usage)', done => {
      let ownerId = 12;
      let pseudoProductOwnerUrl = '/api/PseudoProductOwners';
      let url = `${pseudoProductOwnerUrl}/${ownerId}/demandchain?access_token=${accessToken}`;
      api.get(url)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .expect(200)
        .end((err, resp) => {
          if (err) {
            done(err);
          }
          else {
            let result = resp.body;
            expect(result).to.deep.equal(httpResult);
            done();
          }
        })
    });
  });

  /**
   * These tests describe how the property
   * level personalizations work
   * 
   */
  let CustomerRecords;
  describe('property level personalizations', () => {
    let ModelDefinition = null;

    before('creating models dynamically', done => {
      ModelDefinition = loopback.findModel('ModelDefinition');
      let AccountModel = {
        name: 'Account',
        properties: {
          "accountType": "string",
          "openedOn": "date"
        },
        relations: {
          "customer": {
            type: "embedsOne",
            model: "Customer",
            property: "linkedCustomer"
          }
        }
      };

      let KycModel = {
        name: 'Kyc',
        plural: 'Kyc',
        properties: {
          "criteria": "string",
          "code": "string",
          "remark": "string",
          "score": "number"
        }
      };

      let CustomerModel = {
        name: "XCustomer",
        base: "BaseEntity",
        properties: {
          firstName: "string",
          lastName: "string",
          salutation: "string",
          dob: "date",
          kycInfo: ['Kyc'],
          custRef: "string",
          aadhar: "number"
        },
        relations: {
          all_accounts: {
            type: 'hasMany',
            model: 'Account'
          }
        }
      };


      async.eachSeries([KycModel, CustomerModel, AccountModel], function (spec, cb) {
        spec.mixins = { ServicePersonalizationMixin: true }; //enabling service personalization mixin
        ModelDefinition.create(spec, {}, function (err) {
          cb(err);
        });
      }, function (err) {
        done(err);
      });
    });

    let Customer = null;
    before('creating a new customers', done => {
      Customer = loopback.findModel('XCustomer');
      let data = [
        {
          id: 1,
          firstName: 'Cust',
          lastName: 'One',
          salutation: 'Mr',
          kycInfo: [
            {
              'criteria': 'isEmployed',
              'code': 'BCODE-0056',
              'remark': 'SC Bank',
              'score': 56.23
            },
            {
              'criteria': 'allowedAgeLimit',
              'code': 'BCODE-0057',
              'remark': 'witin 25 to 35',
              'score': 76.24
            }
          ],
          dob: new Date(1987, 3, 12),
          custRef: "HDFC-VCHRY-12354",
          aadhar: 12345678
        },
        {
          id: 2,
          firstName: 'Cust',
          lastName: 'Two',
          salutation: 'Mrs',
          kycInfo: [
            {
              'criteria': 'isEmployed',
              'code': 'BCODE-0056',
              'remark': 'Unemployed',
              'score': -23.23
            },
            {
              'criteria': 'allowedAgeLimit',
              'code': 'BCODE-0058',
              'remark': 'witin 25 to 35',
              'score': 76.24
            }
          ],
          dob: new Date(1989, 3, 12),
          custRef: "ICICI-BLR-0056",
          aadhar: 45248632
        }
      ];
      CustomerRecords = data;
      Customer.create(data, {}, function (err) {
        done(err);
      });
    });

    before('creating personalization rules', done => {
      let data = {
        modelName: 'Kyc',
        personalizationRule: {
          fieldMask: {
            code: {
              'pattern': '([A-Z]{5})\\-(\\d{4})',
              'maskCharacter': '*',
              'format': '$1-$2',
              'mask': ['$1']
            }
          }
        }
      };
      PersonalizationRule.create(data, {}, function (err) {
        done(err);
      });
    });

    it('t42 when fetching a customer record the kycInfo field should also be personalized', done => {
      let custUrl = `/api/XCustomers/1`;
      api.get(custUrl)
        .set('Accept', 'application/json')
        .set('REMOTE_USER', 'testUser')
        .expect(200)
        .end((err, resp) => {
          done(err);
          let result = resp.body;
          expect(result).to.be.object;
          expect(result).to.have.property('firstName');
          expect(result.kycInfo).to.be.array;
          result.kycInfo.forEach(kycItem => {
            let lastFour = kycItem.code.substr(-4);
            let expectedString = `*****-${lastFour}`;
            expect(kycItem.code).to.equal(expectedString);
          });
        });
    });
  });

  /**
   * These set of test cases describe
   * advanced configuration for fieldMask
   * operation
   */

  describe('Advanced fieldMask configurations', () => {
    it('t43 applying string mask on a dob field (date) should throw an error', done => {
      let record = {
        modelName: 'XCustomer',
        personalizationRule: {
          fieldMask: {
            dob: {
              'pattern': '([0-9]{3})([0-9]{3})([0-9]{4})',
              'maskCharacter': 'X',
              'format': '($1) $2-$3',
              'mask': ['$3']
            }
          }
        }
      };

      PersonalizationRule.create(record, {}, function (err) {
        if (err) {
          return done();
        }
        expect(false, 'Should not happen').to.be.ok;
      });
    });

    before('setup rules', done => {
      let data = {
        modelName: 'XCustomer',
        personalizationRule: {
          fieldMask: {
            custRef: {
              stringMask: {
                'pattern': '(\\w+)\\-(\\w+)\\-(\\d+)',
                'maskCharacter': 'X',
                'format': '$1-$2-$3',
                'mask': ['$3']
              }
            },
            dob: {
              dateMask: {
                format: 'MMM/yyyy'
              }
            },
            aadhar: {
              numberMask: {
                pattern: '(\\d{2})(\\d{2})(\\d{2})(\\d{2})',
                format: '$1 $2 $3 $4',
                mask: ['$3', '$4'],
                maskCharacter: '*'
              }
            }
          }
        }
      };

      PersonalizationRule.create(data, {}, function (err) {
        done(err);
      });
    });
    let apiResponse;
    before('fetch api response', done => {
      let url = '/api/XCustomers/2';
      api.get(url)
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, resp) => {
          if (err) {
            return done(err);
          }
          let result = resp.body;
          // expect(result).to.be.object;
          // expect(result.custRef).to.equal('ICICI-BLR-XXXX');
          apiResponse = result;
          done();
        });
    });

    it('t44 should apply a fieldMask on the custRef field which is of type string', () => {
      expect(apiResponse).to.be.object;
      expect(apiResponse.custRef).to.equal('ICICI-BLR-XXXX');
    });

    it('t45 should apply a fieldMask to the dob field and display only month and year', () =>{
      expect(apiResponse.dob).to.equal("Apr/1989");
    });

    it('t46 should apply fieldMask on the aadhar field (numberMask)', () => {
      expect(apiResponse.aadhar).to.equal('45 24 ** **');
    });
  });

  /**
   * these tests describe the gating of personalization rules
   * based on method of the model.
   */

  describe('Method based service personalization', () => {
    before('creating personalization rules', done => {
      let data = {
        modelName: 'XCustomer',
        methodName: 'find',
        personalizationRule: {
          fieldMask: {
            custRef: {
              stringMask: {
                'pattern': '(\\w+)\\-(\\w+)\\-(\\d+)',
                'maskCharacter': 'X',
                'format': '$1-$2-$3',
                'mask': ['$3']
              }
            }
          }
        }
      };

      PersonalizationRule.create(data, {}, function(err){
        done(err);
      });      
    });

    let apiCall1Response;
    before('api call 1 - doing find() remote', done => {
      let url = '/api/XCustomers';
      api.get(url)
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, resp) => {
          if (err) {
            return done(err);
          }
          let result = resp.body;
          apiCall1Response = result;
          done();
        });
    });

    let apiCall2Response;
    before('api call 2 - doing findById() remote', done => {
      let url = '/api/XCustomers/2';
      api.get(url)
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, resp) => {
          if (err) {
            return done(err);
          }
          let result = resp.body;
          apiCall2Response = result;
          done();
        });
    });

    it('t47 should assert that only find() call (i.e, api call 1) is personalized', () => {
      expect(apiCall1Response).to.be.array;
      apiCall1Response.forEach(rec => {
        expect(rec.custRef).to.include('X');
      });
      expect(apiCall2Response).to.be.object;
      expect(apiCall2Response.custRef).to.not.include('X');
    });
  });


  /**
   * These tests describe the role based gating
   * of service personalization
   */

  describe('Role-based service personalization', () => {
    let allUsers;
    before('setting up users and roles', done => {
      let User = loopback.findModel('User');
      let Role = loopback.findModel('Role');
      let RoleMapping = loopback.findModel('RoleMapping');
      expect(typeof User !== 'undefined').to.be.ok;
      expect(typeof Role !== 'undefined').to.be.ok;
      expect(typeof RoleMapping !== 'undefined').to.be.ok;

      User.create([
        { username: 'John', email: 'John@ev.com', password: 'password1' },
        { username: 'Jane', email: 'Jane@ev.com', password: 'password1' },
        { username: 'Bob', email: 'Bob@ev.com', password: 'password1' },
        { username: 'Martha', email: 'Martha@ev.com', password: 'password1' }
      ], function(err, users){
        if(err){
          return done(err);
        }
        allUsers = users;

        Role.create([
          { name: 'admin'},
          { name: 'manager'},
          { name: 'teller' },
          { name: 'agent' },          
        ], function(err, roles){
          if(err){
            return done(err);
          }

          let assignUserRole = (user, role) => cb => role.principals.create({
            principalType: RoleMapping.USER,
            principalId: user.id
          }, function(err){
            cb(err);
          });
          
          ['John', 'Jane', "Bob", 'Martha'].forEach((name, idx) => {
            expect(users[idx].username).to.equal(name);
          });
          
          async.eachSeries([ 
            assignUserRole(users[0], roles[0]),
            assignUserRole(users[1], roles[1]),
            assignUserRole(users[2], roles[2]),
            assignUserRole(users[3], roles[3]),
          ], (fn, done) => fn(done), err => {
            done(err);
          });
        });
      });
    });

    before('setup personalization rules', done => {
      let rules = [
        {
          ruleName: 'for tellers',
          modelName: 'XCustomer',
          personalizationRule: {
            fieldMask : {
              aadhar: {
                numberMask: {
                  pattern: '(\\d{2})(\\d{2})(\\d{2})(\\d{2})',
                  format: '$1-$2-$3-$4',
                  mask: ['$1', '$2', '$3']
                }
              }
            }
          },
          scope: {
            roles: ['teller']
          }
        },
        {
          ruleName: 'for agents',
          modelName: 'XCustomer',
          personalizationRule: {
            fieldMask : {
              custRef: {
                stringMask: {
                  pattern: '(\\w+)\\-(\\w+)\\-(\\d+)',
                  format: '$1-$2-$3',
                  mask: ['$1', '$3']
                }
              }
            }
          },
          scope: {
            roles: ['agent']
          }
        }
      ];

      PersonalizationRule.create(rules, function(err){
        done(err);
      });
    });
    
    let accessTokens;
    before('create access tokens', done => {
      let url = '/api/Users/login';
      async.map(allUsers, function(user, cb){
        let { username } = user;
        api.post(url)
          .set('Accept', 'application/json')
          .send({ username, password: 'password1'})
          .expect(200)
          .end((err, resp) => {
            if(err) {
              return cb(err);
            }
            cb(null, { username, token: resp.body.id });
          });
      }, function(err, results) {
        if(err) {
          return done(err);
        }
        accessTokens = results.reduce((carrier, obj) => Object.assign(carrier, {[obj.username]: obj.token}), {});
        done();
      });
    });

    let tellerResponse;
    before('access teller data via remote', done => {
      let accessToken = accessTokens['Bob'];
      let url = `/api/XCustomers/2?access_token=${accessToken}`;
      api.get(url)
        .set("Accept", 'application/json')
        .expect(200)
        .end((err, resp) => {
          if(err) {
            return done(err);
          }
          tellerResponse = resp.body;
          done();
        });
    });

    let agentResponse;
    before('access agent data via remote', done => {
      let accessToken = accessTokens['Martha'];
      let url = `/api/XCustomers/2?access_token=${accessToken}`;
      api.get(url)
        .set("Accept", 'application/json')
        .expect(200)
        .end((err, resp) => {
          if(err) {
            return done(err);
          }
          agentResponse = resp.body;
          done();
        });
    });

    let managerResponse;
    before('access manager data via remote', done => {
      let accessToken = accessTokens['Jane'];
      let url = `/api/XCustomers/2?access_token=${accessToken}`;
      api.get(url)
        .set("Accept", 'application/json')
        .expect(200)
        .end((err, resp) => {
          if(err) {
            return done(err);
          }
          managerResponse = resp.body;
          done();
        });
    });

    let adminResponse;
    before('access admin data via remote', done => {
      let accessToken = accessTokens['John'];
      let url = `/api/XCustomers/2?access_token=${accessToken}`;
      api.get(url)
        .set("Accept", 'application/json')
        .expect(200)
        .end((err, resp) => {
          if(err) {
            return done(err);
          }
          adminResponse = resp.body;
          done();
        });
    });

    it('t48 should assert that agent and teller results are not identital', () => {
      expect(tellerResponse).to.not.deep.equal(agentResponse);
      let originalRecord = CustomerRecords[1];
      expect(tellerResponse.aadhar).to.equal('XX-XX-XX-' + originalRecord.aadhar.toString().substr(-2));
      expect(agentResponse.custRef).to.equal('XXXXX-BLR-XXXX');
    });

    it('t49 should assert that manager and admin results are identical since there is no personalization rules applied', () => {
      expect(managerResponse).to.deep.equal(adminResponse);
    });

  });

});


