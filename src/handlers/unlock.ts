import { type Request, type Response } from "express"
import Responses from "../responses"
import type Server from ".."

/**
 * Unlock
 *
 * @export
 * @class Unlock
 * @typedef {Unlock}
 */
export class Unlock {
	/**
	 * Creates an instance of Unlock.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Handle unlocking. Not implemented (needed) right now.
	 *
	 * @public
	 * @async
	 * @param {Request} _
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(_: Request, res: Response): Promise<void> {
		try {
			await Responses.notImplemented(res)
		} catch (e) {
			this.server.logger.log("error", e, "unlock")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Unlock
