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
		await Responses.proppatch(res, req.url)
	}
}

export default Proppatch
