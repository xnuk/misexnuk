import Twit = require('twit')
import { misexnuk_pretty } from './misexnuk'

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

export const run = () =>
	T.stream('statuses/filter', {track: '미세즈눅', follow: '1247422820'})

	.on('tweet', tweet => {
		if (tweet == null || tweet.text == null) return
		// tweet.id_str
		// tweet.user.id_str
		const text = (tweet.text as string)
			.replace(/^@x_nuk\s+/, '')
			.replace(/https?:\/\/t.co\/[^\s]*/, '')

		if (text.includes('\n') || !/^미세즈눅/.test(text)) return

		const query = text.replace(/^미세즈눅\s*/, '').trim()

		const reply = (status: string) => T.post('statuses/update', {
			status,
			auto_populate_reply_metadata: true,
			trim_user: true,
			in_reply_to_status_id: tweet.id_str as string
		} as any)

		if (query === '') {
			reply('네?')
		} else {
			misexnuk_pretty(query).then(v => reply(v))
		}
	})
