import 'dotenv/config'
import { misexnukPretty } from '../src/misexnuk'
import { getEnv } from './env'

const { KAKAO_TOKEN } = getEnv()

misexnukPretty(KAKAO_TOKEN)(process.argv[process.argv.length - 1])
	.then(res =>
		typeof res === 'string'
			? console.error(res)
			: console.log(res.text)
	)
