import 'dotenv/config'
import { run } from '../src/twit'
import { getEnv } from './env'

const { TWITTER_CREDENTIAL, KAKAO_TOKEN } = getEnv()

run(TWITTER_CREDENTIAL, KAKAO_TOKEN)
