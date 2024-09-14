import pathModule from "path"
import fs from "fs-extra"
import os from "os"
import { xxHash32 } from "js-xxhash"

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

/**
 * Return the platforms config path.
 *
 * @export
 * @returns {string}
 */
export function platformConfigPath(): string {
	// Ref: https://github.com/FilenCloudDienste/filen-cli/blob/main/src/util.ts

	let configPath = ""

	switch (process.platform) {
		case "win32":
			configPath = pathModule.resolve(process.env.APPDATA!)
			break
		case "darwin":
			configPath = pathModule.resolve(pathModule.join(os.homedir(), "Library/Application Support/"))
			break
		default:
			configPath = process.env.XDG_CONFIG_HOME
				? pathModule.resolve(process.env.XDG_CONFIG_HOME)
				: pathModule.resolve(pathModule.join(os.homedir(), ".config/"))
			break
	}

	if (!configPath || configPath.length === 0) {
		throw new Error("Could not find homedir path.")
	}

	configPath = pathModule.join(configPath, "@filen", "webdav")

	if (!fs.existsSync(configPath)) {
		fs.mkdirSync(configPath, {
			recursive: true
		})
	}

	return configPath
}

export function tempDiskPath(): string {
	const path = pathModule.join(platformConfigPath(), "tempDiskFiles")

	if (!fs.existsSync(path)) {
		fs.mkdirSync(path, {
			recursive: true
		})
	}

	return path
}

const reservedWindowsNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
// eslint-disable-next-line no-control-regex
const invalidChars = /[<>:"/\\|?*\x00-\x1F]/g

export function sanitizeFileName(fileName: string): string {
	const sanitized = fileName.replace(invalidChars, "").replace(/\.+$/, "").replace(/\s+/g, "_").slice(0, 255)

	if (reservedWindowsNames.test(sanitized)) {
		return "_" + sanitized
	}

	return sanitized
}

export function fastStringHash(input: string): string {
	return input.substring(0, 8) + xxHash32(input, 0).toString(16) + input.substring(input.length - 8, input.length)
}

export function pathToTempDiskFileId(path: string, username?: string): string {
	return sanitizeFileName(fastStringHash(username ? username + "_" + path : path))
}
