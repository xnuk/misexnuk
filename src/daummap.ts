import Axios from 'axios'
import { LatLng } from './common'

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

const xyToLatLng = ({x, y}: {x: string, y: string}) => ({lng: x, lat: y})

const converter = ({data}: any): Promise<LatLng> =>
	(data && data.documents && data.documents[0])
		? Promise.resolve(xyToLatLng(data.documents[0]))
		: Promise.reject()

export const search = (query: string): Promise<LatLng> => {
	const address = mapSearch.get('/address.json', {
		params: {query, page: 1, size: 1}
	}).then(converter)

	const keyword = mapSearch.get('/keyword.json', {
		params: {query, page: 1, size: 1, sort: 'accuracy'}
	}).then(converter)

	return address.catch(() => keyword)
}
