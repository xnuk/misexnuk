import { Twit, TwitterCredential } from '../modulize/twit'
import { misexnukPretty } from './misexnuk'
import { Redis, RedisEnv } from './redis'
import { LatLng } from './common'

const tweetLocationPrefix = 'LOCATION:'
const tweetDeletePrefix = 'DELETE:'
const tweetSinceTweetIdKey = 'SINCE_TWEET_ID'

const replyTweet = (T: Twit) => (id_str: string, status: string) =>
	new Promise<{id_str: string}>((res, rej) =>
		T.post('statuses/update', {
			status,
			auto_populate_reply_metadata: true,
			trim_user: true,
			in_reply_to_status_id: id_str as string
		} as object, (e, d) => e ? rej(e) : res(d as {id_str: string}))
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

		if (cachedLocation != null) {
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

const tweetChaser = (
	keyValue: ReturnType<typeof Redis>,
	handler: ReturnType<typeof twitHandler>
) => (tweet: any) => {
	if (tweet == null || tweet.text == null) return
	console.log(tweet.text)

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
		keyValue.set(
			tweetDeletePrefix + tweet.id_str,
			id_str,
		)
	)
}

const delayMs = (n: number): Promise<void> =>
	new Promise(res => setTimeout(res, n))

const withBound = (n: number) => async <T>(
	promise: () => Promise<T>
): Promise<T> => {
	const time = delayMs(n)
	const p = await promise()
	await time
	return p
}

const getList = (
	T: Twit,
	list_id: string,
	since_id?: string
): Promise<any[]> => new Promise(res =>
	T.get('lists/statuses',
		Object.assign({
			include_rts: false,
			include_entities: false,
			list_id,
			count: 50
		}, {since_id}) as object,
		(e, d) => e ? (console.warn(e), res([])) : res(d as object[])
	)
)

const listStream = (
	T: Twit,
	keyValue: ReturnType<typeof Redis>,
	list_id: string
) => async (cb: (tweet: any) => void) => {
	let since_id: string | null =
		await keyValue.get(tweetSinceTweetIdKey).catch(() => null)

	const listBind = getList.bind(null, T, list_id)
	const list = () => since_id == null ? listBind() : listBind(since_id)
	const bound = withBound(3000)

	console.log('a')
	while(true) {
		await bound(async () => {
			const tweets = await list()
			console.log('c')

			if (tweets[0]) {
				since_id = tweets[0].id_str
				tweets.forEach(cb)
			}
		})
	}
}

export const run = (
	twitter: TwitterCredential,
	kakaoToken: string,
	redisEnv: RedisEnv,
	list_id: string,
) => {
	const T = new Twit(twitter)
	const keyValue = Redis(redisEnv)
	const handler = twitHandler(T, kakaoToken)
	const listener = tweetChaser(keyValue, handler)
	const stream = listStream(T, keyValue, list_id)

	return stream(listener)
	// return T.stream('statuses/filter', {
	// 	track: '미세즈눅',
	// 	follow: '1247422820'
	// })

	// .on('tweet', listener)
}
