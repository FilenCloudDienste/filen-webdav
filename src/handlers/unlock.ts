import { type Request, type Response } from "express"
import Responses from "../responses"

/**
 * Unlock
 *
 * @export
 * @class Unlock
 * @typedef {Unlock}
 */
export class Unlock {
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
		} catch {
			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Unlock
