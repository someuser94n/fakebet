const koa = require("koa");
const config = require("config");

let app = new koa();

app.use(require("handlers/cors"));
app.use(require("handlers/body-parser"));
app.use(require("handlers/logger"));
app.use(require("handlers/static"));
app.use(require("handlers/error"));
app.use(require("handlers/authenticity"));

app.use(require("routes"));

app.listen(config.port, () => console.log(`start at ${config.port} port`));
