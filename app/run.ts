import 'dotenv/config'
import { run } from '../src/twit'
import { getEnv } from './env'

const { TWITTER_CREDENTIAL, KAKAO_TOKEN, REDIS_ENV, TWITTER_LIST_ID } = getEnv()

const { stream, deleter } =
	run(TWITTER_CREDENTIAL, KAKAO_TOKEN, REDIS_ENV, TWITTER_LIST_ID)

stream()
deleter()
