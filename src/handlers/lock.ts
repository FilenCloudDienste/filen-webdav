import { type Request, type Response } from "express"
import Responses from "../responses"
import type Server from ".."

/**
 * Lock
 *
 * @export
 * @class Lock
 * @typedef {Lock}
 */
export class Lock {
	/**
	 * Creates an instance of Lock.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Handle locking. Not implemented (needed) right now.
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
			this.server.logger.log("error", e, "lock")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Lock
