import { type Request, type Response, type NextFunction } from "express"
import type Server from ".."
import pathModule from "path"
import { PassThrough, Readable } from "stream"
import { IncomingMessage } from "http"
import { v4 as uuidv4 } from "uuid"
import mimeTypes from "mime-types"
import { removeLastSlash } from "../utils"
import Responses from "../responses"

/**
 * Put
 *
 * @export
 * @class Put
 * @typedef {Put}
 */
export class Put {
	/**
	 * Creates an instance of Put.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Check if the incoming request stream contains data.
	 *
	 * @public
	 * @param {IncomingMessage} req
	 * @returns {Promise<{ hasData: boolean; buffer: Buffer }>}
	 */
	public reqHasData(req: IncomingMessage): Promise<{ hasData: boolean; buffer: Buffer }> {
		return new Promise((resolve, reject) => {
			if (!(req instanceof Readable)) {
				resolve({ hasData: false, buffer: Buffer.from([]) })

				return
			}

			const bufferedChunks: Buffer[] = []
			let hasData = false
			const passThrough = new PassThrough()

			req.pipe(passThrough)

			const cleanup = async () => {
				try {
					passThrough.pause()

					req.unpipe(passThrough)
				} catch (e) {
					// Noop
				}
			}

			passThrough.on("data", async (chunk: Buffer) => {
				if (chunk instanceof Buffer && chunk.byteLength > 0) {
					hasData = true
					bufferedChunks.push(chunk)

					await cleanup()

					resolve({
						hasData,
						buffer: Buffer.concat(bufferedChunks)
					})
				}
			})

			passThrough.on("end", async () => {
				await cleanup()

				resolve({
					hasData,
					buffer: Buffer.concat(bufferedChunks)
				})
			})

			passThrough.on("error", async (err: Error) => {
				await cleanup()

				reject(err)
			})

			req.resume()
		})
	}

	/**
	 * Upload a file to the requested URL. If the incoming stream contains no data, we create a virtual file instead (Windows likes this).
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @param {NextFunction} next
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
		await this.server.getRWMutexForUser(req.url, req.username).acquire()

		try {
			const path = removeLastSlash(decodeURI(req.url))
			const parentPath = pathModule.posix.dirname(path)
			const name = pathModule.posix.basename(path)
			const parentResource = await this.server.pathToResource(req, parentPath)

			// The SDK handles checking if a file with the same name and parent already exists
			if (!parentResource || parentResource.type !== "directory") {
				await Responses.preconditionFailed(res)

				return
			}

			const { hasData, buffer } = await this.reqHasData(req)

			if (!hasData) {
				this.server.getVirtualFilesForUser(req.username)[path] = {
					type: "file",
					uuid: uuidv4(),
					path: path,
					url: path,
					isDirectory() {
						return false
					},
					isFile() {
						return true
					},
					isSymbolicLink() {
						return false
					},
					mtimeMs: Date.now(),
					region: "",
					bucket: "",
					birthtimeMs: Date.now(),
					key: "",
					lastModified: Date.now(),
					name,
					mime: mimeTypes.lookup(name) || "application/octet-stream",
					version: 2,
					chunks: 1,
					size: 0,
					isVirtual: true
				}

				await Responses.created(res)

				return
			}

			let didError = false
			const readStream = new PassThrough()

			readStream.on("error", err => {
				didError = true

				next(err)
			})

			req.on("error", err => {
				didError = true

				next(err)
			})

			readStream.write(buffer)
			req.pipe(readStream)

			if (didError) {
				return
			}

			const sdk = this.server.getSDKForUser(req.username)

			if (!sdk) {
				await Responses.notAuthorized(res)

				return
			}

			const item = await sdk.cloud().uploadLocalFileStream({
				source: readStream,
				parent: parentResource.uuid,
				name,
				onError: err => {
					delete this.server.getVirtualFilesForUser(req.username)[path]

					didError = true

					next(err)
				}
			})

			delete this.server.getVirtualFilesForUser(req.username)[path]

			if (didError) {
				return
			}

			if (item.type !== "file") {
				await Responses.badRequest(res)

				return
			}

			await sdk.fs()._removeItem({ path })
			await sdk.fs()._addItem({
				path,
				item: {
					type: "file",
					uuid: item.uuid,
					metadata: {
						name,
						size: item.size,
						lastModified: item.lastModified,
						creation: item.creation,
						hash: item.hash,
						key: item.key,
						bucket: item.bucket,
						region: item.region,
						version: item.version,
						chunks: item.chunks,
						mime: item.mime
					}
				}
			})

			await Responses.created(res)
		} finally {
			this.server.getRWMutexForUser(req.url, req.username).release()
		}
	}
}

export default Put
