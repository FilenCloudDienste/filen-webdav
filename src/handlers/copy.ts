import { type Request, type Response } from "express"
import type Server from ".."
import Responses from "../responses"

/**
 * Copy
 *
 * @export
 * @class Copy
 * @typedef {Copy}
 */
export class Copy {
	/**
	 * Creates an instance of Copy.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Copy a file or a directory to the destination provided in the header.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response): Promise<void> {
		await this.server.getRWMutexForUser(req.url, req.username).acquire()

		try {
			const resource = await this.server.urlToResource(req)

			if (!resource) {
				await Responses.notFound(res, req.url)

				return
			}

			await Responses.notImplemented(res)
		} finally {
			this.server.getRWMutexForUser(req.url, req.username).release()
		}
	}
}

export default Copy
