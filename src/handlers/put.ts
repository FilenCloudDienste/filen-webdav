import { type Request, type Response } from "express"
import type Server from ".."
import pathModule from "path"
import { v4 as uuidv4 } from "uuid"
import mimeTypes from "mime-types"
import { removeLastSlash, pathToTempDiskFileId } from "../utils"
import Responses from "../responses"
import { PassThrough, pipeline, Transform } from "stream"
import { promisify } from "util"
import fs from "fs-extra"
import { UPLOAD_CHUNK_SIZE } from "@filen/sdk"

const pipelineAsync = promisify(pipeline)

export class SizeCounter extends Transform {
	private totalBytes: number

	public constructor() {
		super()

		this.totalBytes = 0
	}

	public size(): number {
		return this.totalBytes
	}

	public _transform(chunk: Buffer, _: BufferEncoding, callback: () => void): void {
		this.totalBytes += chunk.length

		this.push(chunk)

		callback()
	}

	public _flush(callback: () => void): void {
		callback()
	}
}

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
	 * Upload a file to the requested URL. If the incoming stream contains no data, we create a virtual file instead (Windows likes this).
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response): Promise<void> {
		try {
			const path = removeLastSlash(decodeURI(req.url))
			const parentPath = pathModule.posix.dirname(path)
			const name = pathModule.posix.basename(path)
			const thisResource = await this.server.pathToResource(req, path)

			// The SDK handles checking if a file with the same name and parent already exists
			if (thisResource && thisResource.type === "directory") {
				await Responses.alreadyExists(res)

				return
			}

			const sdk = this.server.getSDKForUser(req.username)

			if (!sdk) {
				await Responses.notAuthorized(res)

				return
			}

			await sdk.fs().mkdir({ path: parentPath })

			const parentResource = await this.server.pathToResource(req, parentPath)

			if (!parentResource || parentResource.type !== "directory") {
				await Responses.preconditionFailed(res)

				return
			}

			if (!req.firstBodyChunk || req.firstBodyChunk.byteLength === 0) {
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

				delete this.server.getTempDiskFilesForUser(req.username)[path]

				return
			}

			let didError = false
			const stream = new PassThrough()

			await new Promise<void>((resolve, reject) => {
				stream.write(req.firstBodyChunk, err => {
					if (err) {
						reject(err)

						return
					}

					resolve()
				})
			})

			stream.on("error", () => {
				delete this.server.getVirtualFilesForUser(req.username)[path]
				delete this.server.getTempDiskFilesForUser(req.username)[path]

				didError = true

				Responses.internalError(res).catch(() => {})
			})

			if (this.server.putMatcher && (this.server.putMatcher(path) || this.server.putMatcher(name))) {
				const destinationTempDiskFileId = pathToTempDiskFileId(path, req.username)

				await fs.rm(pathModule.join(this.server.tempDiskPath, destinationTempDiskFileId), {
					force: true,
					maxRetries: 60 * 10,
					recursive: true,
					retryDelay: 100
				})

				const sizeCounter = new SizeCounter()

				await pipelineAsync(
					req.pipe(stream),
					sizeCounter,
					fs.createWriteStream(pathModule.join(this.server.tempDiskPath, destinationTempDiskFileId), {
						flags: "w",
						autoClose: true
					})
				)

				this.server.getTempDiskFilesForUser(req.username)[path] = {
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
					mtimeMs: Date.now(),
					region: "",
					bucket: "",
					birthtimeMs: Date.now(),
					key: "",
					lastModified: Date.now(),
					name,
					mime: mimeTypes.lookup(name) || "application/octet-stream",
					version: 2,
					chunks: Math.ceil(sizeCounter.size() / UPLOAD_CHUNK_SIZE),
					size: sizeCounter.size(),
					isVirtual: false,
					tempDiskId: destinationTempDiskFileId
				}

				delete this.server.getVirtualFilesForUser(req.username)[path]

				await Responses.created(res)

				return
			}

			const item = await sdk.cloud().uploadLocalFileStream({
				source: req.pipe(stream),
				parent: parentResource.uuid,
				name,
				onError: () => {
					delete this.server.getVirtualFilesForUser(req.username)[path]
					delete this.server.getTempDiskFilesForUser(req.username)[path]

					didError = true

					Responses.internalError(res).catch(() => {})
				}
			})

			delete this.server.getVirtualFilesForUser(req.username)[path]
			delete this.server.getTempDiskFilesForUser(req.username)[path]

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
		} catch (e) {
			console.error(e)

			this.server.logger.log("error", e, "put")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Put
