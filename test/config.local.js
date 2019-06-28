var config = require('./config.json');

config.servicePersonalization.customFunctionPath = process.env.custom_function_path || config.servicePersonalization.customFunctionPath;

module.exports = config;
