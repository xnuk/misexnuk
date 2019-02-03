class StringWrapper {
	constructor(public text: string) {}

	split(delimiter: string): [string, string] {
		const text = this.text
		const i = text.indexOf(delimiter)
		if (i >= 0) return [
			text.slice(0, i),
			text.slice(i + delimiter.length)
		]
		return [text, '']
	}

	after(delimiter: string): StringWrapper {
		this.text = this.split(delimiter)[1]
		return this
	}

	popBefore(delimiter: string, trim: boolean = true): string {
		const split = this.split(delimiter)
		const res = split[0]
		this.text = split[1]
		return trim ? res.trim() : res
	}
}

const semiDataRegex = `
	%[
		' ([0-2]?[0-9])시 ' ,
		([0-9]*|null) ,
		[^%[%]]*
	%]
`.trim().replace(/%/g, '\\').replace(/\s+/g, '\\s*')

const semiDataParser = (text: string) => {
	const sequence: [number, number | null][] = []
	text.replace(new RegExp(semiDataRegex, 'g'), (_, time, data) => {
		sequence.push([+time, (data === '' || data === null) ? null : +data])
		return ''
	})
	
	const time = sequence[sequence.length - 1][0]
	return {
		time,
		data: sequence.map(arr => arr[1])
	}
}


const getAddress = (body: StringWrapper): string => body
	.after('<div id="header">')
	.after('<h1><span class="tit">')
	.popBefore('<')

const getType = (body: StringWrapper): {[caption: string]: string} => {
	const key = 'mainChart' + body
		.after("<li id='jsAnchorDust")
		.popBefore("'")

	const caption = body
		.after('<div class="tit')
		.after('>')
		.popBefore('</div>')
		.split('<span class="bt">', 1)[0]
		.trim()
		.replace(/<[^>]+>/g, '')
		.replace(/[^0-9A-Z]+/g, '')

	return {[caption]: key}
}

const getPmKeys = (body: StringWrapper): {PM10?: string, PM25?: string} => {
	const {PM10, PM25} = Object.assign(
		getType(body),
		getType(body),
		getType(body),
		getType(body),
		getType(body),
	)

	return {PM10, PM25}
}

const getData = (body: StringWrapper): {[key: string]: string} => {
	const array = body
		.after('new google.visualization.DataTable();')
		.after('data.addRows([')
		.popBefore(']);')

	const key = body
		.after('document.getElementById(')
		.popBefore(")")
		.replace(/['"()]/g, '')
	return {[key]: array}
}

const getPmData = (
	body: StringWrapper,
	keys: {PM10?: string, PM25?: string}
): {
	PM10?: ReturnType<typeof semiDataParser>,
	PM25?: ReturnType<typeof semiDataParser>,
} => {
	const o = Object.assign(
		getData(body),
		getData(body),
		getData(body),
		getData(body),
		getData(body),
	)
	
	return Object.assign(
		{},
		...Object.keys(o).map(key => {
		if (key === keys.PM10) return {PM10: semiDataParser(o[key])}
		if (key === keys.PM25) return {PM25: semiDataParser(o[key])}
		return null
		})
	)
}

export const parse = (text: string): {
	address: string,
	time: number,
	pm10?: (number|null)[],
	pm25?: (number|null)[]
} => {
	const body = new StringWrapper(text)

	const address = getAddress(body)

	const keys = getPmKeys(body)

	body
		.after('<script')
		.after('//7가지 물질 차트생성')


	const {PM10, PM25} = getPmData(body, keys)
	const time =
		PM10 && PM10.time ||
		PM25 && PM25.time ||
		(() => {throw 'there no pm10 or pm25'})()

	return {address, time, pm10: PM10 && PM10.data, pm25: PM25 && PM25.data}
}
