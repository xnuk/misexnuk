import { Twit } from '../modulize/twit'
import 'dotenv/config'
import { getEnv } from './env'

const getMembers = (T: Twit, list_id: string) => () => new Promise<string[]>((res, rej) =>
	T.get('lists/members', {
		list_id ,
		count: 5000,
		include_entities: false,
		skip_status: true
	} as any, (e, d) =>
		e ? rej(e) : res(
			(d as {users: {id_str: string}[]}).users.map(v => v.id_str)
		)
	)
)

const getFollowings = (T: Twit) => () => new Promise<string[]>((res, rej) =>
	T.get('friends/ids', { stringify_ids: true, count: 5000 }, (e, d) =>
		e ? rej(e) : res((d as {ids: string[]}).ids)
	)
)

const memberDestroy = (T: Twit, list_id: string) => (user_id: string[], _ = console.log('destroy', user_id)) =>
	user_id.length > 0 ? new Promise<{user: {id_str: string}}>((res, rej) =>
		T.post('lists/members/destroy_all', {
			list_id,
			user_id: user_id.join(',')
		} as any, (e, d) =>
			e ? rej(e) : res(d as {user: {id_str: string}})
		)
	) : Promise.resolve(null)

const memberPut = (T: Twit, list_id: string) => (user_id: string[], _ = console.log('put', user_id)) =>
	user_id.length > 0 ? new Promise<{user: {id_str: string}}>((res, rej) =>
		T.post('lists/members/create_all', {
			list_id,
			user_id: user_id.join(',')
		} as any, (e, d) =>
			e ? rej(e) : res(d as {user: {id_str: string}})
		)
	) : Promise.resolve(null)

const main = async () => {
	const { TWITTER_CREDENTIAL, TWITTER_LIST_ID } = getEnv()
	const T = new Twit(TWITTER_CREDENTIAL)
	const put = memberPut(T, TWITTER_LIST_ID)
	const destroy = memberDestroy(T, TWITTER_LIST_ID)
	const members = getMembers(T, TWITTER_LIST_ID)
	const followings = getFollowings(T)

	const [oldOne, newOne] = await Promise.all([members(), followings()])

	const removeSet = new Set(oldOne.slice())
	const addSet = new Set(newOne.slice())

	newOne.forEach(v => removeSet.delete(v))
	oldOne.forEach(v => addSet.delete(v))

	console.log(removeSet, addSet)

	const toDestroy = [...removeSet.values()]
	while(toDestroy.length > 0) {
		await destroy(toDestroy.splice(0, 100))
		await new Promise(res => setTimeout(res, 3000))
	}

	let me: {user: {id_str: string}} | null = null
	const toPut = [...addSet.values()]
	while(toPut.length > 0) {
		me = (await put(toPut.splice(0, 100)))
		await new Promise(res => setTimeout(res, 3000))
	}

	if (me && me.user && me.user.id_str) {
		console.log(me)
		await put([me.user.id_str])
	}

}

main()
