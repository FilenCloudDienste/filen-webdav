import { type Request, type Response } from "express"
import type Server from ".."
import pathModule from "path"
import Mutex from "../mutex"
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
		await Mutex.acquireReadWrite(req.url)

		try {
			const path = decodeURI(req.url.endsWith("/") ? req.url.slice(0, req.url.length - 1) : req.url)
			const parentPath = pathModule.posix.dirname(path)
			const [parentResource, thisResource] = await Promise.all([
				this.server.pathToResource(req, parentPath),
				this.server.pathToResource(req, path)
			])

			if (!parentResource || parentResource.type !== "directory") {
				await Responses.forbidden(res)

				return
			}

			if (thisResource && thisResource.type === "directory") {
				await Responses.forbidden(res)

				return
			}

			const sdk = this.server.getSDKForUser(req.username)

			if (!sdk) {
				await Responses.notAuthorized(res)

				return
			}

			await sdk.fs().mkdir({ path })

			await Responses.created(res)
		} finally {
			Mutex.releaseReadWrite(req.url)
		}
	}
}

export default Mkcol
