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
      // if(err) {
      //   done(err)
      // }
      // else {
      //   let persOpts = {
      //     isBeforeRemote: false, context: options
      //   };
      //   applyServicePersonalization('ProductOwner', result, persOpts, function(err){
      //     done(err, result);
      //   });
      // }
      done(err, result);
    })
  };
}