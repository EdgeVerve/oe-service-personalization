var oecloud = require('oe-cloud');
var loopback = require('loopback');

oecloud.boot(__dirname, function (err) {
    oecloud.start();
    oecloud.emit('test-start');
});

var chalk = require('chalk');
var chai = require('chai');
chai.use(require('chai-things'));
var expect = chai.expect;

var ProductCatalog;
var app = oecloud;
var defaults = require('superagent-defaults');
var supertest = require('supertest');

var api = defaults(supertest(app));
var basePath = app.get('restApiRoot');
productCatalogUrl=basePath + '/ProductCatalogs';
describe(chalk.blue('service personalization test started...'), function () {
    this.timeout(80000);
    before('wait for boot scripts to complete', function (done) {
        app.on('test-start', function () {
            ProductCatalog = loopback.findModel('ProductCatalog');
            ProductCatalog.destroyAll(function (err, info) {
                return done(err);
            });
        });
    });

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

    it('service personalization test - should replace field names in response when fieldReplace personalization is configured', function (done) {
        // Setup personalization rule
        var ruleForAndroid = {
            'modelName': 'ProductCatalog',
            'personalizationRule': {
                'fieldReplace': {
                    'name': 'product name',
                    'desc': 'product description',
                }
            },
            'scope': {
                'device': 'android'
            }
        };

        var ruleModel = loopback.findModel('PersonalizationRule');
        ruleModel.create(ruleForAndroid, function (err, rule) {
            if (err) {
                return done(new Error(err));
            }
            //var ruleId = rule.id;
            api.get(productCatalogUrl)
              .set('Accept', 'application/json')
              .set('REMOTE_USER', 'testUser')
              .set('device', 'android')
              .expect(200).end(function (err, resp) {
                  if (err) {
                      done(err);
                  }
				  console.log(resp.body);
                  // console.log('resp ---------->' + JSON.stringify(resp.body, null, 2));

                  var results = resp.body; //JSON.parse(resp.text);

                  expect(results.length).to.be.equal(6);
                  expect(results[0])
                    .to.include.keys('product name', 'product description');
                  expect(results[0])
                    .to.not.include.keys('name', 'desc');
                  done();

              });

        });
    });

});



