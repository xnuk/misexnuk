import { Twit } from '../modulize/twit'
import 'dotenv/config'
import { getEnv } from './env'

const getLists = (T: Twit) => new Promise<{uri: string, name: string, id_str: string}[]>((res, rej) =>
	T.get('lists/list', (e, d) =>
		e ? rej(e) : res(d as {uri: string, name: string, id_str: string}[])
	)
)

const main = async () =>
	(await getLists(new Twit(getEnv().TWITTER_CREDENTIAL))).forEach(({uri, name, id_str}) =>
		console.log(`${id_str}\t${name} (${uri})`)
	)

main()
