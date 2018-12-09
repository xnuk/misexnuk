import Axios from 'axios'

const mapSearch = Axios.create({
	method: 'GET',
	baseURL: 'https://dapi.kakao.com/v2/local/search/',
	headers: {
		'Authorization': 'KakaoAK ' +
			(process.env.KAKAO_REST_API_TOKEN || (() => {
				throw "There's no KAKAO_REST_API_TOKEN."
			})())
	},
	responseType: 'json'
})

// x = lng, y = lat
const converter = ({data}: any): Promise<{x: string, y: string}> =>
	(data && data.documents && data.documents[0])
		? Promise.resolve(data.documents[0] as {x: string, y: string})
		: Promise.reject()

export const search = (query: string): Promise<{x: string, y: string}> => {
	const address = mapSearch.get('/address.json', {
		params: {query, page: 1, size: 1}
	}).then(converter)

	const keyword = mapSearch.get('/keyword.json', {
		params: {query, page: 1, size: 1, sort: 'accuracy'}
	}).then(converter)

	return address.catch(() => keyword)
}
