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