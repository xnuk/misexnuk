import { RedisClient, createClient } from 'redis'

export type RedisEnv = {
	host: string,
	port: number,
	prefix: string
}

type Callback<T, E extends Error = Error> = (err: E | null, res: T) => void

const hole = <T>(func: (cb: Callback<T>) => void): Promise<T> =>
	new Promise<T>((res, rej) =>
		func((err, reply) => err ? rej(err) : res(reply))
	)

function get(this: RedisClient, key: string): Promise<string> {
	return hole($ => this.get(key, $))
}

function set(
	this: RedisClient,
	key: string, value: string, expireSeconds?: number,
): Promise<'OK' | void> {
	return expireSeconds == null
		? hole($ => this.set(key, value, $))
		: hole($ => this.set(key, value, 'ex', expireSeconds, $))
}

function hset(
	this: RedisClient,
	key: string, field: string, value: string,
): Promise<number> {
	return hole($ => this.hset(key, field, value, $))
}

function hgetall(
	this: RedisClient,
	key: string
): Promise<{[key: string]: string}> {
	return hole($ => this.hgetall(key, $))
}

function hdel(
	this: RedisClient,
	key: string, fields: string[] | string
): Promise<number> {
	return hole($ => this.hdel(key, fields, $))
}

function quit(this: RedisClient): Promise<'OK'> {
	return hole($ => this.quit($))
}

export const Redis = ({host, port, prefix}: RedisEnv) => {
	const client = createClient({
		host,
		port,
		prefix: prefix + ':',
	})

	return {
		get: get.bind(client),
		set: set.bind(client),
		hset: hset.bind(client),
		quit: quit.bind(client),
		hgetall: hgetall.bind(client),
		hdel: hdel.bind(client),
	}
}
