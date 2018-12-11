import { createClient } from 'redis';

const getEnv = (key: string): string => {
	const res = process.env[key]
	if (res == null || res === '') throw "There's no " + key
	return res
}

export const Redis = () => {
	const client = createClient({
		host: getEnv('REDIS_HOST'),
		port: +getEnv('REDIS_PORT'),
		prefix: getEnv('REDIS_PREFIX'),
	})

	return {
		get: (key: string): Promise<string> => new Promise((res, rej) => client.get(
			key,
			(err, reply) => err ? rej(err) : res(reply)
		)),
		set: (key: string, value: string, expireSeconds?: number): Promise<'OK' | undefined> => new Promise((res, rej) => {
			const cb = (err: Error | null, reply: 'OK' | undefined) => err ? rej(err) : res(reply)
			return expireSeconds == null ? client.set(key, value, cb) : client.set(key, value, 'ex', expireSeconds, cb)
		}),
		hset: (key: string, field: string, value: string): Promise<number> => new Promise((res, rej) => {
			const cb = (err: Error | null, reply: number) => err ? rej(err) : res(reply)
			return client.hset(key, field, value, cb)
		}),
		quit: (cb: () => void) => client.quit(cb)
	}
}
