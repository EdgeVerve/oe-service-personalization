var md5 = require('md5');

function customFn(ctx) {
    ctx.result = ctx.result.map((item) => {
        item.name = md5(item.name);
        return item;
    });
}

module.exports = {
    customFn
}