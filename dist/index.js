"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const koa_1 = __importDefault(require("koa"));
const koa_router_1 = __importDefault(require("koa-router"));
const jimp_1 = __importDefault(require("jimp"));
const axios_1 = __importDefault(require("axios"));
const superagent_1 = __importDefault(require("superagent"));
const cheerio_1 = __importDefault(require("cheerio"));
const url_1 = __importDefault(require("url"));
const router = new koa_router_1.default();
const koa = new koa_1.default();
router.get('/', async (ctx, next) => {
    ctx.body = `<a href="https://github.com/cutls/fedi-favicon-api">fedi-favicon-api</a>`;
});
router.get('/get', async (ctx, next) => {
    ctx.body = { success: false, note: 'please look at GitHub to make a valid request' };
});
router.get('/get/:domain', async (ctx, next) => {
    let file = null;
    let type = ctx.query.type;
    const domain = ctx.params.domain;
    if (!type)
        type = await detect(domain);
    if (!type) {
        ctx.body = { success: false };
        return false;
    }
    const result = await superagent_1.default.get(`https://${domain}`);
    const $ = cheerio_1.default.load(result.text);
    file = $('link[rel=icon]').attr('href');
    if (!file)
        file = 'favicon.ico';
    file = url_1.default.resolve(`https://${domain}`, file);
    if (!file) {
        ctx.body = { success: false };
        return false;
    }
    const gotimg = await jimp_1.default.read(`https://images.weserv.nl/?url=${file}&output=png&w=50`);
    const compared = await getCompared(type);
    const diff = jimp_1.default.distance(gotimg, compared);
    let isDefault = false;
    if (diff < 0.21)
        isDefault = true;
    ctx.body = { success: true, difference: diff, type: type, isDefault: isDefault, url: file };
});
router.get('/c/:file', async (ctx, next) => {
    const file = new Buffer(ctx.params.file, 'base64').toString();
    const gotimg = await jimp_1.default.read(`https://images.weserv.nl/?url=${file}&output=png&w=15`);
    const buffer = await gotimg.getBufferAsync(jimp_1.default.MIME_PNG);
    ctx.set('Content-Type', `image/png`);
    ctx.body = buffer;
});
koa.use(router.routes());
koa.use(router.allowedMethods());
koa.listen(4000, () => {
    console.log('Server started!!');
});
async function getCompared(type) {
    let file;
    if (type == 'mastodon')
        file = 'mastodon.png';
    if (type == 'pleroma')
        file = 'pleroma.png';
    if (type == 'misskey')
        file = 'misskey.png';
    if (type == 'misskeylegacy')
        file = 'misskeyv11.png';
    if (type == 'pixelfed')
        file = 'pixelfed.png';
    const res = await jimp_1.default.read('assets/' + file);
    const resized = await res.resize(50, jimp_1.default.AUTO);
    return resized;
}
async function detect(domain) {
    let type;
    try {
        const donOrKey = await axios_1.default.get(`https://${domain}/favicon.ico`);
        if (donOrKey.headers['content-type'] == 'text/html; charset=utf-8')
            throw 0;
        try {
            const mastodon = await axios_1.default.get(`https://${domain}/api/v1/instance`);
            type = 'mastodon';
        }
        catch {
            //Misskeyである可能性
            try {
                const misskey = await axios_1.default.post(`https://${domain}/api/meta`);
                //13以降の動向が不明
                let v11 = false;
                let data = misskey.data;
                if (!data.version.match(/12\.[0-9]{1,}\.[0-9]{1,}/))
                    v11 = true;
                type = 'misskey';
                if (v11)
                    type = 'misskeylegacy';
            }
            catch (e) {
                console.log(e);
                type = null;
            }
        }
    }
    catch {
        try {
            const isFedi = await axios_1.default.get(`https://${domain}/api/v1/instance`);
            try {
                const pleroma = await axios_1.default.get(`https://${domain}/favicon.png`);
                //Pleroma
                type = 'pleroma';
            }
            catch {
                //PixelFed
                type = 'pixelfed';
            }
        }
        catch {
            type = null;
        }
    }
    return type;
}
