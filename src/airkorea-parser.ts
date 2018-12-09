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

export const parse = (text: string): {
	address: string,
	time: number,
	pm10: (number|null)[],
	pm25: (number|null)[]
} => {
	const body = new StringWrapper(text)

	const address = body
		.after('<div id="header">')
		.after('<h1><span class="tit">')
		.popBefore('<')

	body
		.after('<script')
		.after('//7가지 물질 차트생성')

	const data = () => body
		.after('new google.visualization.DataTable();')
		.after('data.addRows([')
		.popBefore(']);')

	data() // CAI
	const {time, data: pm10} = semiDataParser(data())
	const pm25 = semiDataParser(data()).data

	return {address, time, pm10, pm25}
}
