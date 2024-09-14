import { type Request, type Response } from "express"
import type Server from ".."
import mimeTypes from "mime-types"
import { Readable, pipeline } from "stream"
import { type ReadableStream as ReadableStreamWebType } from "stream/web"
import Responses from "../responses"
import { parseByteRange } from "../utils"
import fs from "fs-extra"
import pathModule from "path"
import { promisify } from "util"

const pipelineAsync = promisify(pipeline)

/**
 * Get
 *
 * @export
 * @class Get
 * @typedef {Get}
 */
export class Get {
	/**
	 * Creates an instance of Get.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Download the requested file as a readStream.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response): Promise<void> {
		try {
			const resource = await this.server.urlToResource(req)

			if (!resource || resource.type === "directory") {
				await Responses.notFound(res, req.url)

				return
			}

			if (resource.isVirtual) {
				res.status(200)
				res.set("Content-Type", resource.mime)
				res.set("Content-Length", "0")

				Readable.from([]).pipe(res)

				return
			}

			const sdk = this.server.getSDKForUser(req.username)

			if (!sdk) {
				await Responses.notAuthorized(res)

				return
			}

			const mimeType = mimeTypes.lookup(resource.name) || "application/octet-stream"
			const totalLength = resource.size
			const range = req.headers.range || req.headers["content-range"]
			let start = 0
			let end = totalLength - 1

			if (range) {
				const parsedRange = parseByteRange(range, totalLength)

				if (!parsedRange) {
					await Responses.badRequest(res)

					return
				}

				start = parsedRange.start
				end = parsedRange.end

				res.status(206)
				res.set("Content-Range", `bytes ${start}-${end}/${totalLength}`)
				res.set("Content-Length", (end - start + 1).toString())
			} else {
				res.status(200)
				res.set("Content-Length", resource.size.toString())
			}

			res.set("Content-Type", mimeType)
			res.set("Accept-Ranges", "bytes")

			if (resource.tempDiskId) {
				await pipelineAsync(
					fs.createReadStream(pathModule.join(this.server.tempDiskPath, resource.tempDiskId), {
						autoClose: true,
						flags: "r",
						start,
						end
					}),
					res
				)
			} else {
				const stream = sdk.cloud().downloadFileToReadableStream({
					uuid: resource.uuid,
					bucket: resource.bucket,
					region: resource.region,
					version: resource.version,
					key: resource.key,
					size: resource.size,
					chunks: resource.chunks,
					start,
					end
				})

				const nodeStream = Readable.fromWeb(stream as unknown as ReadableStreamWebType<Buffer>)

				const cleanup = () => {
					try {
						stream.cancel().catch(() => {})

						if (!nodeStream.closed && !nodeStream.destroyed) {
							nodeStream.destroy()
						}
					} catch {
						// Noop
					}
				}

				res.once("close", () => {
					cleanup()
				})

				res.once("error", () => {
					cleanup()
				})

				res.once("finish", () => {
					cleanup()
				})

				req.once("close", () => {
					cleanup()
				})

				req.once("error", () => {
					cleanup()
				})

				nodeStream.once("error", () => {
					cleanup()
				})

				nodeStream.pipe(res)
			}
		} catch (e) {
			this.server.logger.log("error", e, "get")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Get
