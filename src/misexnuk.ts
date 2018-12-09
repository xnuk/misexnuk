import { airkorea } from './airkorea';
import { search } from './daummap';

export const misexnuk = async (query: string) => {
	const {x: lng, y: lat} = await search(query).catch(() => Promise.reject({type: 'search_error'}))
	return await airkorea(lat, lng).catch(() => Promise.reject({type: 'parse_error'}))
}

const pm10Level = (pm: number | null): string =>
	pm === null ? '정보 없음' :
	pm <= 30 ? '좋음(~30)' :
	pm <= 80 ? '주의(31~80)' :
	pm <= 150 ? '나쁨(81~150)' :
	'개같음(151~)'

const pm25Level = (pm: number | null): string =>
	pm === null ? '정보 없음' :
	pm <= 15 ? '좋음(~15)' :
	pm <= 35 ? '주의(16~35)' :
	pm <= 75 ? '나쁨(36~75)' :
	'개같음(76~)'

const tweetLength = (str: string): number =>
	str.split('').reduce((sum, ch) => {
		const c = ch.charCodeAt(0)
		return sum + (
			(
				c >= 0 && c <= 4351
				|| c >= 8192 && c <= 8205
				|| c >= 8208 && c <= 8223
				|| c >= 8242 && c <= 8247
			) ? 1 : 2
		)
	}, 0)


export const misexnuk_pretty = (query: string) => misexnuk(query).then(
	({address, time, pm10, pm25}) => {
		const timeAt = `${time}시 기준, `

		const pm10Arrow =
			`PM10: ${
				pm10Level(pm10[pm10.length - 1])
			} ${
				pm10
					.slice(pm10.length - 8)
					.map(v => v === null ? '' : v)
					.join('→')
			}`

		const pm25Arrow =
			`PM2.5: ${
				pm25Level(pm25[pm25.length - 1])
			} ${
				pm25
					.slice(pm25.length - 8)
					.map(v => v === null ? '' : v)
					.join('→')
			}`

		const footer = '(㎍/㎥, 시간 단위)'

		const addressLength = (
			280 - tweetLength([timeAt, pm10Arrow, pm25Arrow, footer].join('\n'))
		) / 2 | 0

		console.log(addressLength)

		return [
			timeAt + address.slice(0, addressLength),
			pm10Arrow,
			pm25Arrow,
			footer
		].join('\n')
	}
).catch(err =>
		!err ? '왜인진 모르겠습니다만 실패했습니다. ✨ 잠시 후 다시 시도해보세요.' :
		err.type === 'search_error' ? '알 수 없는 위치입니다.' :
		err.type === 'parse_error' ? '해당하는 위치의 미세먼지 정보를 가져오지 못했습니다. 잠시 후 다시 시도해보세요.' :
		'왜인진 모르겠습니다만 실패했습니다. ✨ 잠시 후 다시 시도해보세요.' 
)
