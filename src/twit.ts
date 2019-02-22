import { Twit, TwitterCredential } from '../modulize/twit'
import { misexnukPretty } from './misexnuk'
import { Redis, RedisEnv } from './redis'
import { LatLng } from './common'

type KeyValue = ReturnType<typeof Redis>

const tweetLocationPrefix = 'LOCATION:'
const tweetDeleteKey = 'DELETE'
const tweetSinceTweetIdKey = 'SINCE_TWEET_ID'

const getSinceTweetId = (keyValue: KeyValue) =>
	keyValue.get(tweetSinceTweetIdKey).catch(() => null)

const setSinceTweetId = (keyValue: KeyValue, value: string) =>
	keyValue.set(tweetSinceTweetIdKey, value)

const replyTweet = (T: Twit) => (id_str: string, status: string) =>
	new Promise<{id_str: string}>((res, rej) =>
		T.post('statuses/update', {
			status,
			auto_populate_reply_metadata: true,
			trim_user: true,
			in_reply_to_status_id: id_str as string
		} as object, (e, d) => e ? rej(e) : res(d as {id_str: string}))
	)

const deleteTweet = (T: Twit) => (id_str: string): Promise<void> =>
	new Promise(res =>
		T.post('statuses/destroy/:id', {
			id: id_str,
			trim_user: true,
		}, () => res())
	)

const lookupTweets = (
	T: Twit
) => (ids: string[]): Promise<{[id: string]: object | null}> =>
	new Promise((res, rej) =>
		T.get('statuses/lookup', {
			id: ids.join(','),
			include_entities: false,
			trim_user: true,
			map: true,
			include_ext_alt_text: false,
			include_card_uri: false
		} as any, (e, d) => e
			? rej(e)
			: res((d as any).id)
		)
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
		return reply('미세즈눅 황간역')
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
		keyValue.hset(
			tweetDeleteKey,
			tweet.id_str,
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

const forever = (ms: number) => {
	const bound = withBound(ms)
	return async (promise: () => Promise<any>) => {
		while (true) {
			await bound(promise).catch(() => {})
		}
	}
}

const getList = (
	T: Twit,
	list_id: string,
) => (
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
	keyValue: ReturnType<typeof Redis>,
	listBind: (since_id?: string) => Promise<any[]>
) => async (cb: (tweet: any) => void) => {
	let since_id: string | null = await getSinceTweetId(keyValue)

	const list = () => since_id == null ? listBind() : listBind(since_id)

	forever(3000)(async () => {
		const tweets = await list()
		let promise: Promise<any> = Promise.resolve()

		if (tweets[0]) {
			since_id = tweets[0].id_str as string
			promise = setSinceTweetId(keyValue, since_id)
			tweets.forEach(cb)
		}

		await promise
	})
}

const compare = <T>(a: T, b: T): -1 | 0 | 1 => a<b ? -1 : a>b ? 1 : 0
const bigIntCompare = (a: string, b: string) =>
	(a.length - b.length) || compare(a, b)

const tweetDeleter = (
	keyValue: ReturnType<typeof Redis>,
	remove: (id: string) => Promise<void>,
	lookup: (ids: string[]) => Promise<{[id: string]: null | object}>,
) => async () => {
	const tweetMap = await keyValue
		.hgetall(tweetDeleteKey)
		.then(o => o || {}, () => ({}))

	const ids = Object.keys(tweetMap).sort(bigIntCompare)
	if (ids.length < 1) Promise.resolve()

	const recentTweets = await lookup(ids.splice(-100))
	const goneIds =
		Object.keys(recentTweets).filter(key => recentTweets[key] == null)

	const deleteIds = ids.concat(goneIds)

	const promises = deleteIds.map(id => {
		const tweetId = tweetMap[id]
		Promise.all([
			keyValue.hdel(tweetDeleteKey, id),
			remove(tweetId),
		])
	})

	await Promise.all(promises)
}
const tweetDeleteJob = (
	keyValue: ReturnType<typeof Redis>,
	remove: (id: string) => Promise<void>,
	lookup: (ids: string[]) => Promise<{[id: string]: null | object}>,
) => () => forever(3000)(tweetDeleter(keyValue, remove, lookup))

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
	const remove = deleteTweet(T)
	const lookup = lookupTweets(T)
	const deleter = tweetDeleteJob(keyValue, remove, lookup)
	const stream = listStream(keyValue, getList(T, list_id))

	return {stream: () => stream(listener), deleter}
}
