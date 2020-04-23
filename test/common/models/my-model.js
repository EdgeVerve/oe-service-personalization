module.exports = function myModelBoot(MyModel) {
  // MyModel.beforeRemote('**', function(ctx, unused, next) {
  //   console.log(`BeforeRemote MethodString: ${ctx.methodString}`);
  //   process.nextTick(function(){
  //     next();
  //   });
  // });

  // MyModel.afterRemote('**', function(ctx, unused, next) {
  //   console.log(`AfterRemote MethodString: ${ctx.methodString}`);
  //   process.nextTick(function(){
  //     next();
  //   });
  // });

  MyModel.remoteMethod('exec', {
    description: 'do something',
    accessType: 'WRITE',
    accepts: [
      {
        arg: 'documentName',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        },
        description: 'Name of the Document to be fetched from db for rule engine'
      },
      {
        arg: 'data',
        type: 'object',
        required: true,
        http: {
          source: 'body'
        },
        description: 'An object on which business rules should be applied'
      }
    ],
    http: {
      verb: 'post',
      path: '/exec/:documentName'
    },
    returns: {
      arg: 'data',
      type: 'object',
      root: true
    }
  });

  MyModel.exec = function(docName, data, callback) {
    data.docName = docName;
    process.nextTick(function(){
      callback(null, data);
    });
  };

  MyModel.remoteMethod('foo', {
    description: "foo desc",
    isStatic: false,
    http: { path: '/foo', verb: 'get' },
    returns: {
      arg:'name', type: 'string'
    }
  });

  MyModel.prototype.foo = function() {
    let args = [].slice.call(arguments);
    let callback = args.find(arg => typeof arg === 'function');
    process.nextTick(function() {
      callback(null, { "result": "foo"})
    })
  }

  // var toJSON = MyModel.prototype.toJSON

  // MyModel.prototype.toJSON = function() {
  //   var self = this;
  //   console.log('This is a patched toJSON call')
  //   return toJSON.call(self)
  // }
}