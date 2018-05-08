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
describe(chalk.blue('service personalization test started...'), function () {
  this.timeout(10000);
  before('wait for boot scripts to complete', function (done) {
    app.on('test-start', function () {
      ProductCatalog = loopback.findModel('ProductCatalog');
      ProductCatalog.destroyAll(function (err, info) {
        return done(err);
      });
    });
  });
  PersonalizationRule = loopback.findModel('PersonalizationRule');
  it('service personalization test - create test data', function (done) {
    // Populate some data.
    var item1 = {
      'name': 'king size bed',
      'category': 'furniture',
      'desc': 'king size bed',
      'price': {
        'value': 10000,
        'currency': 'inr'
      },
      'isAvailable': true
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
    'city': 'Miami'
  };

  var owner2 = {
    'name': 'Wick',
    'city': 'Texas'
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
      api.get(productCatalogUrl)
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


      api.get(productCatalogUrl)
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
          api.get(productCatalogUrl)
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
          api.get(productCatalogUrl)
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
          api.get(productCatalogUrl)
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
          api.get(productCatalogUrl)
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
          api.get(productCatalogUrl + '?access_token=' + '1'+ '&filter[fields][name]=true')
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
            api.get(productCatalogUrl + '?access_token=' + '1' + '&filter[order]=name DESC')
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
          api.get(productCatalogUrl)
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
          api.get(productCatalogUrl + '?filter[fields][name]=true')
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
});

