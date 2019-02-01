export const requiredEnvs: string[] = []
export const allEnvs: string[] = []

const env = (key: string): string => {
	allEnvs.push(key)
	const res = process.env[key]
	return res || (requiredEnvs.push(key), '')
}

const KAKAO_TOKEN = env('KAKAO_REST_API_TOKEN')

const TWITTER_CREDENTIAL = {
	consumer_key: env('TWITTER_CONSUMER_KEY'),
	consumer_secret: env('TWITTER_CONSUMER_SECRET'),
	access_token: env('TWITTER_ACCESS_TOKEN'),
	access_token_secret: env('TWITTER_ACCESS_TOKEN_SECRET')
}

const REDIS_ENV = {
	host: env('REDIS_HOST'),
	port: +env('REDIS_PORT'),
	prefix: env('REDIS_PREFIX')
}

const TWITTER_LIST_ID = env('TWITTER_LIST_ID')

export const getEnv = () => {
	if (requiredEnvs.length === 0) return {
		KAKAO_TOKEN,
		TWITTER_CREDENTIAL,
		REDIS_ENV,
		TWITTER_LIST_ID,
	}

	throw `
You'll need to give the following environment variable(s):
	${requiredEnvs.join(', ')}

Fill following envs in your ${'`'}/.env${'`'} file:

	${allEnvs.join('=\n\t')}=

Thank you for your contributing.
`.trim()
}
