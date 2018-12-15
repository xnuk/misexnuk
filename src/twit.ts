import Twit = require('twit')
import { misexnukPretty } from './misexnuk'
import { Redis, RedisEnv } from './redis'
import { LatLng } from './common'

type TwitterCredential = {
	consumer_key: string,
	consumer_secret: string,
	access_token: string,
	access_token_secret: string
}

const tweetLocationPrefix = 'LOCATION:'
const tweetDeletePrefix = 'DELETE:'

const replyTweet = (T: Twit) => (id_str: string, status: string) =>
	new Promise<{id_str: string}>((res, rej) =>
		T.post('statuses/update', {
			status,
			auto_populate_reply_metadata: true,
			trim_user: true,
			in_reply_to_status_id: id_str as string
		} as any, (e, d) => e ? rej(e) : res(d as {id_str: string}))
	)

const encodeLocation = ({lat, lng}: LatLng) => lat + ',' + lng
const decodeLocation = (hash: string): LatLng | null => {
	const [lat, lng] = hash.split(',')
	return (
		lat !== '' && lat != null &&
		lng !== '' && lng != null
	) ? { lat, lng } : null
}

const twitHandler = (T: Twit, kakaoToken: string) => async (
	keyValue: ReturnType<typeof Redis>,
	id_str: {tweet: string, user: string},
	query: string,
) => {
	const replyT = replyTweet(T)
	const reply = (status: string) => replyT(id_str.tweet, status)

	const misexnuk = misexnukPretty(kakaoToken)

	let location: {lat: string, lng: string} | string = query
	if (query === '') {
		const cachedLocation =
			await keyValue.get(tweetLocationPrefix + id_str.user)
				.catch(() => null)

		if (cachedLocation) {
			location = decodeLocation(cachedLocation) || ''
		}
	}

	if (location === '') {
		return reply('네?')
	} else {
		const result = await misexnuk(location)
		if (typeof result === 'string') return reply(result)

		const { location: newLocation, text } = result

		if (
			typeof location === 'string' ||
			!(
				newLocation.lng === location.lng
				&& newLocation.lat === location.lat
			)
		) keyValue.set(
			tweetLocationPrefix + id_str.user,
			encodeLocation(newLocation),
		)

		return reply(text)
	}
}

export const run = (
	twitter: TwitterCredential,
	kakaoToken: string,
	redisEnv: RedisEnv,
) => {
	const T = new Twit(twitter)
	const keyValue = Redis(redisEnv)
	const handler = twitHandler(T, kakaoToken)

	return T.stream('statuses/filter', {
		track: '미세즈눅',
		follow: '1247422820'
	})

	.on('tweet', tweet => {
		if (tweet == null || tweet.text == null) return

		const text = (tweet.text as string)
			.replace(/^@x_nuk\s+/, '')
			.replace(/https?:\/\/t.co\/[^\s]*/, '')

		if (text.includes('\n') || !/^미세즈눅/.test(text)) return

		const query = text.replace(/^미세즈눅\s*/, '').trim()

		const userId = tweet.user.id_str
		const tweetId = tweet.id_str

		handler(
			keyValue,
			{tweet: tweetId, user: userId},
			query,
		).then(({id_str}) =>
			keyValue.hset(
				tweetDeletePrefix + tweet.user.id_str,
				tweet.id_str,
				id_str,
			)
		)
	})
}
