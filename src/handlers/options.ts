import { type Request, type Response } from "express"
import Responses from "../responses"
import type Server from ".."

/**
 * Options
 *
 * @export
 * @class Options
 * @typedef {Options}
 */
export class Options {
	/**
	 * Creates an instance of Options.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Options
	 *
	 * @public
	 * @async
	 * @param {Request} _
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(_: Request, res: Response): Promise<void> {
		try {
			await Responses.ok(res)
		} catch (e) {
			this.server.logger.log("error", e, "options")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Options
