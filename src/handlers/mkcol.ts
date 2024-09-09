import { type Request, type Response } from "express"
import type Server from ".."
import pathModule from "path"
import Responses from "../responses"

/**
 * Mkcol
 *
 * @export
 * @class Mkcol
 * @typedef {Mkcol}
 */
export class Mkcol {
	/**
	 * Creates an instance of Mkcol.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Create a directory at the requested URL.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response): Promise<void> {
		try {
			const path = decodeURI(req.url.endsWith("/") ? req.url.slice(0, req.url.length - 1) : req.url)
			const parentPath = pathModule.posix.dirname(path)
			const parentResource = await this.server.pathToResource(req, parentPath)

			// The SDK handles checking if a directory with the same name and parent already exists
			if (!parentResource || parentResource.type !== "directory") {
				await Responses.preconditionFailed(res)

				return
			}

			const sdk = this.server.getSDKForUser(req.username)

			if (!sdk) {
				await Responses.notAuthorized(res)

				return
			}

			await sdk.fs().mkdir({ path })

			await Responses.created(res)
		} catch (e) {
			this.server.logger.log("error", e, "mkcol")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Mkcol
