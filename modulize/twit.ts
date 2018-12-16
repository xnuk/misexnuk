import Twit = require('twit')
export { Twit }

export type TwitterCredential = {
	consumer_key: string,
	consumer_secret: string,
	access_token: string,
	access_token_secret: string
}
