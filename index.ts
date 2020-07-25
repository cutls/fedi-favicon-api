import Koa from 'koa'
import Router from 'koa-router'
import Jimp from 'jimp'
import axios from 'axios'

const router = new Router()
const koa = new Koa()

router.get('/get/:domain', async (ctx, next) => {
	let file = null
	const obj = ctx.query.type
	const domain: string = ctx.params.domain
	let type
	if (obj) type = obj.type
	if (!type) type = await detect(domain)
	if (type == 'mastodon') file = 'favicon.ico'
	if (type == 'pleroma') file = 'favicon.png'
	if (type == 'misskey') file = 'favicon.ico'
	if (type == 'misskeyv11') file = 'favicon.ico'
	if (type == 'pixelfed') file = 'img/favicon.png'
	if (!file) {
		ctx.body = { success: false }
		return false
	}
	const gotimg = await Jimp.read(`https://images.weserv.nl/?url=${domain}/${file}&output=png&w=50`)
	const compared = await getCompared(type)
	const diff = Jimp.distance(gotimg, compared)
	let isDefault = false
	if(diff < 0.21) isDefault = true
	ctx.body = { success: true, difference: diff, type: type, isDefault: isDefault }
})

koa.use(router.routes())
koa.use(router.allowedMethods())

koa.listen(4000, () => {
	console.log('Server started!!')
})

async function getCompared(type: null | string) {
	let file
	if (type == 'mastodon') file = 'mastodon.png'
	if (type == 'pleroma') file = 'pleroma.png'
	if (type == 'misskey') file = 'misskey.png'
	if (type == 'misskeyv11') file = 'misskeyv11.png'
	if (type == 'pixelfed') file = 'pixelfed.png'
	const res = await Jimp.read('assets/' + file)
	const resized = await res.resize(50, Jimp.AUTO)
	return resized
}
async function detect(domain: string) {
	let type: string
	try {
		const donOrKey = await axios.get(`https://${domain}/favicon.ico`)
		if(donOrKey.headers['content-type'] == 'text/html; charset=utf-8') throw 0
		console.log(donOrKey.headers['content-type'])
		try {
			const mastodon = await axios.get(`https://${domain}/api/v1/instance`)
			type = 'mastodon'
		} catch {
			//Misskeyである可能性
			try {
				const misskey = await axios.post(`https://${domain}/api/meta`)
				//13以降の動向が不明
				let v11 = false
				let data = misskey.data
				if (!data.version.match(/12\.[0-9]{1,}\.[0-9]{1,}/)) v11 = true
				type = 'misskey'
				if (v11) type = 'misskeyv11'
			} catch (e) {
				console.log(e)
				type = ''
			}
		}
	} catch {
		try {
			const isFedi = await axios.get(`https://${domain}/api/v1/instance`)
			try {
				const pleroma = await axios.get(`https://${domain}/favicon.png`)
				//Pleroma
				type = 'pleroma'
			} catch {
				//PixelFed
				type = 'pixelfed'
			}
		} catch {
			type = ''
		}
	}
	return type
}
