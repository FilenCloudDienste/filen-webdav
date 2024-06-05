/**
 * Chunk large Promise.all executions.
 * @date 2/14/2024 - 11:59:34 PM
 *
 * @export
 * @async
 * @template T
 * @param {Promise<T>[]} promises
 * @param {number} [chunkSize=10000]
 * @returns {Promise<T[]>}
 */
export async function promiseAllChunked<T>(promises: Promise<T>[], chunkSize = 100000): Promise<T[]> {
	const results: T[] = []

	for (let i = 0; i < promises.length; i += chunkSize) {
		const chunkResults = await Promise.all(promises.slice(i, i + chunkSize))

		results.push(...chunkResults)
	}

	return results
}

export function removeLastSlash(str: string): string {
	return str.endsWith("/") ? str.substring(0, str.length - 1) : str
}

/**
 * Parse the requested byte range from the header.
 *
 * @export
 * @param {string} range
 * @param {number} totalLength
 * @returns {({ start: number; end: number } | null)}
 */
export function parseByteRange(range: string, totalLength: number): { start: number; end: number } | null {
	const [unit, rangeValue] = range.split("=")

	if (unit !== "bytes" || !rangeValue) {
		return null
	}

	const [startStr, endStr] = rangeValue.split("-")

	if (!startStr) {
		return null
	}

	const start = parseInt(startStr, 10)
	const end = endStr ? parseInt(endStr, 10) : totalLength - 1

	if (isNaN(start) || isNaN(end) || start < 0 || end >= totalLength || start > end) {
		return null
	}

	return { start, end }
}
