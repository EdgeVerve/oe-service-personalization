var md5 = require('md5');

function customFn(ctx) {
    if(ctx.result && ctx.result.length > 1) {
        ctx.result = ctx.result.map((item) => {
            item.name = md5(item.name);
            return item;
        });
    } else if(ctx.res.body) {
        ctx.res.body.name = md5(ctx.res.body.name);
    } else {
        ctx.result.name = md5(ctx.result.name);
    }
}

function hashReqBody(ctx) {
    if(ctx.req.body) {
        ctx.req.body.name = md5(ctx.req.body.name);
    }
}

module.exports = {
    customFn,
    hashReqBody
}