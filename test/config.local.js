var config = require('./config.json');

// add customFunctionPath to config if environment variable is present
if (process.env.custom_function_path && !config.servicePersonalization) {
    config.servicePersonalization = new Object({
        customFunctionPath: process.env.custom_function_path
    });
} else if (process.env.custom_function_path && config.servicePersonalization) {
    config.servicePersonalization.customFunctionPath = process.env.custom_function_path;
} else {
    config.servicePersonalization.customFunctionPath = config.servicePersonalization.customFunctionPath
}

module.exports = config;
