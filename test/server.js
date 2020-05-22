var oecloud = require('oe-cloud');
oecloud.boot(__dirname, function (err) {
  oecloud.enableAuth();
  oecloud.start();
  oecloud.emit('test-start');
});
