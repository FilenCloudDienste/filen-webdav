import { type Request, type Response } from "express"
import Responses from "../responses"
import type Server from ".."

/**
 * Proppatch
 *
 * @export
 * @class Proppatch
 * @typedef {Proppatch}
 */
export class Proppatch {
	/**
	 * Creates an instance of Proppatch.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Handle property patching. Not implemented (needed) right now.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response): Promise<void> {
		try {
			await Responses.proppatch(res, req.url)
		} catch (e) {
			this.server.logger.log("error", e, "proppatch")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Proppatch
