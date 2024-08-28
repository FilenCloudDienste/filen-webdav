import { type Request, type Response } from "express"
import Responses from "../responses"

/**
 * Proppatch
 *
 * @export
 * @class Proppatch
 * @typedef {Proppatch}
 */
export class Proppatch {
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
		} catch {
			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Proppatch
