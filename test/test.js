var oecloud = require('oe-cloud');
var loopback = require('loopback');

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
  this.timeout(10000);
  var accessToken;
  before('wait for boot scripts to complete', function (done) {
    app.on('test-start', function () {
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
        } else {
          // accessToken = res.body.id;
          return done();
        }
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
        } else {
          accessToken = res.body.id;
          return done();
        }
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
      "productOwnerId": 1
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
      //var ruleId = rule.id;

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
        //var ruleId = rule.id;

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

  //Nested input values
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
            } else {
              return false;
            }
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
            } else {
              return false;
            }
          });
          expect(result[0].price).keys('currency', 'value');
          expect(result[0]).to.include.keys('category', 'price', 'isAvailable', 'id', 'name', 'desc');
          expect(result[0].name).to.be.equal('oven');
          expect(result[0].price.currency).to.be.equal('inr');
          done();

        });
    });
  });

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
            "Bravo": 'B'
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
          "keywords": ["Alpha", "Bravo", "Charlie", "Delta"],
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
      "modelName": "ProductCatalog",
      "personalizationRule": {
        "fieldMask": {
          "modelNo": {
            "pattern": "([0-9]{3})([0-9]{3})([0-9]{4})",
            "maskCharacter": "X",
            "format": "($1) $2-$3",
            "mask": ['$3']
          }
        }
      },
      "scope": {
        "region": "us"
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
          "keywords": ["Alpha", "Bravo"],
          'isAvailable': true,
          'id': 'watch2',
          "modelNo": "1233567891"
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
      "modelName": "ProductCatalog",
      "personalizationRule": {
        "fieldMask": {
          "modelNo": {
            "pattern": "([0-9]{5})([0-9]{1})([0-9]{4})",
            "maskCharacter": "-",
            "format": "+91 $1 $2$3",
            "mask": ['$3']
          }
        }
      },
      "scope": {
        "region": "in"
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
          "keywords": ["Charlie", "India"],
          'isAvailable': true,
          'id': 'watch3',
          "modelNo": "9080706050"
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
      "modelName": "ProductCatalog",
      "personalizationRule": {
        "fieldMask": {
          "modelNo": {
            "pattern": "([0-9]{5})([0-9]{1})([0-9]{4})",
            "maskCharacter": "X",
            "format": "+91 $1 $2$3"
          }
        }
      },
      "scope": {
        "region": "ka"
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
      "modelName": "ProductCatalog",
      "personalizationRule": {
        "fieldMask": {
          "modelNo": {
            "pattern": "([0-9]{5})([0-9]{1})([0-9]{4})",
            "maskCharacter": "X",
            "mask": ['$3']
          }
        }
      },
      "scope": {
        "region": "kl"
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

  describe('Relation Tests - ', function () {
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
        }
      };

      var CustomerModelSpec = {
        name: 'Customer',
        properties: {
          name: 'string',
          age: 'number',
          relations: {
            address: {
              type: 'embedsOne',
              model: 'Address',
              property: 'billingAddress'
            }
          }
        }
      };

      ModelDefinition.create([CustomerModelSpec, AddressModelSpec], defContext, function (err, data) {
        if (err) {
          done(err)
        }
        else {

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
        }
        else {
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
            console.log(results);
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
              done(err);
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

});


