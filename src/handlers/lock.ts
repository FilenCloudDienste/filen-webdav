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
		await Responses.notImplemented(res)
	}
}

export default Lock
