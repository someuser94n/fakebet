const path = require("path");
const send = require("koa-send");

module.exports = async (ctx, next) => {

    if(ctx.path === "/") return await send(ctx, "front/dist/index.html");

    let ext = path.extname(ctx.path);
    if(ext) return await send(ctx, ctx.path, {root: "front/dist"});

    let route = ctx.path.slice(1);
    let urlsFromFront = ["matches", "auth", "about", "bets"];
    if(ctx.method === "GET" && urlsFromFront.includes(route)) return await send(ctx, "front/dist/index.html");

    // v1.1 428kb

    await next();
};