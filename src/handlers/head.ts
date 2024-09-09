import { type Request, type Response } from "express"
import type Server from ".."
import mimeTypes from "mime-types"
import Responses from "../responses"
import { parseByteRange } from "../utils"

/**
 * Head
 *
 * @export
 * @class Head
 * @typedef {Head}
 */
export class Head {
	/**
	 * Creates an instance of Head.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Head a file.
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

			if (!resource) {
				await Responses.notFound(res, req.url)

				return
			}

			if (resource.type === "directory") {
				await Responses.forbidden(res)

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
					res.status(400).end()

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

			await new Promise<void>(resolve => {
				res.end(() => {
					resolve()
				})
			})
		} catch (e) {
			this.server.logger.log("error", e, "head")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Head
