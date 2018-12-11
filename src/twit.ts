import Twit = require('twit')
import { misexnuk_pretty } from './misexnuk'
import { Redis } from './redis';

const tweetLocationPrefix = 'LOCATION:'
const tweetDeletePrefix = 'DELETE:'

const getEnv = (key: string): string => {
	const res = process.env[key]
	if (res == null || res === '') throw "There's no " + key
	return res
}

const T = new Twit({
	consumer_key: getEnv('TWITTER_CONSUMER_KEY'),
	consumer_secret: getEnv('TWITTER_CONSUMER_SECRET'),
	access_token: getEnv('TWITTER_ACCESS_TOKEN'),
	access_token_secret: getEnv('TWITTER_ACCESS_TOKEN_SECRET')
})

const replyTweet = (id_str: string, status: string) => new Promise<{id_str: string}>((res, rej) =>
	T.post('statuses/update', {
		status,
		auto_populate_reply_metadata: true,
		trim_user: true,
		in_reply_to_status_id: id_str as string
	} as any, (e, d) => e ? rej(e) : res(d as {id_str: string}))
)

const encodeLocation = ({lat, lng}: {lat: string, lng: string}) => lat + ',' + lng
const decodeLocation = (hash: string): {lat: string, lng: string} | null => {
	const [lat, lng] = hash.split(',')
	if (lat !== '' && lat != null && lng !== '' && lng != null) return { lat, lng }
	return null
}

const twitHandler = async (keyValue: ReturnType<typeof Redis>, id_str: string, query: string) => {
	const reply = (status: string) => replyTweet(id_str, status)

	let location: {lat: string, lng: string} | string = query
	if (query === '') {
		const cachedLocation = await keyValue.get(tweetLocationPrefix + id_str).catch(() => null)
		if (cachedLocation) {
			location = decodeLocation(cachedLocation) || ''
		}
	}

	if (location === '') {
		return reply('네?')
	} else {
		const result = await misexnuk_pretty(location)
		if (typeof result === 'string') return reply(result)

		const { location: newLocation, text } = result

		if (
			typeof location === 'string' ||
			!(newLocation.lng === location.lng && newLocation.lat === location.lat)
		) keyValue.set(tweetLocationPrefix + id_str, encodeLocation(newLocation))

		return reply(text)
	}
}

export const run = () => {
	const keyValue = Redis()
	return T.stream('statuses/filter', {track: '미세즈눅', follow: '1247422820'})

	.on('tweet', tweet => {
		if (tweet == null || tweet.text == null) return
		// tweet.id_str
		// tweet.user.id_str
		const text = (tweet.text as string)
			.replace(/^@x_nuk\s+/, '')
			.replace(/https?:\/\/t.co\/[^\s]*/, '')

		if (text.includes('\n') || !/^미세즈눅/.test(text)) return

		const query = text.replace(/^미세즈눅\s*/, '').trim()

		twitHandler(keyValue, tweet.id_str, query).then(({id_str}) =>
			keyValue.hset(tweetDeletePrefix + tweet.user.id_str, tweet.id_str, id_str)
		)
	})
}
