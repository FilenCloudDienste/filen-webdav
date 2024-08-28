import { type Request, type Response } from "express"
import Responses from "../responses"

/**
 * Lock
 *
 * @export
 * @class Lock
 * @typedef {Lock}
 */
export class Lock {
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
		} catch {
			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Lock
