module.exports = function ()  {
  return function(req, res, next) {
    console.log(req.accessToken);
    next();
  }
}