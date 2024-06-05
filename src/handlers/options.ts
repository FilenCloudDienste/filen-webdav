import { type Request, type Response } from "express"
import Responses from "../responses"

/**
 * Options
 *
 * @export
 * @class Options
 * @typedef {Options}
 */
export class Options {
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
		await Responses.ok(res)
	}
}

export default Options
