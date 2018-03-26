const Koa_router = require("koa-router");

const publicRoute = new Koa_router();

let matches = require("./matches");

publicRoute.get("/matches", matches.checkDB, matches.parser, matches.writeDB);


module.exports = publicRoute.routes();