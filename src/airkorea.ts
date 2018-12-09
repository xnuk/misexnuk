import Axios from 'axios'
import { parse } from './airkorea-parser'

export const airkorea = (lat: string, lng: string) =>
	Axios.get('http://m.airkorea.or.kr/main', {
		params: {lat, lng},
		responseType: 'text'
	}).then(res => parse(res.data))
