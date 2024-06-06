import { type Request, type Response, type NextFunction } from "express"
import type Server from ".."
import mimeTypes from "mime-types"
import { Readable } from "stream"
import { type ReadableStream as ReadableStreamWebType } from "stream/web"
import Responses from "../responses"
import { parseByteRange } from "../utils"

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
	 * @param {NextFunction} next
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
		await this.server.getRWMutexForUser(req.url, req.username).acquire()

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

			const stream = await sdk.cloud().downloadFileToReadableStream({
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

			nodeStream.once("error", next)

			nodeStream.pipe(res)
		} finally {
			this.server.getRWMutexForUser(req.url, req.username).release()
		}
	}
}

export default Get