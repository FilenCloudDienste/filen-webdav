import { type ErrorRequestHandler } from "express"

/**
 * WebDAVError
 *
 * @export
 * @class WebDAVError
 * @typedef {WebDAVError}
 * @extends {Error}
 */
export class WebDAVError extends Error {
	public errno: number
	public code: number

	/**
	 * Creates an instance of WebDAVError.
	 *
	 * @constructor
	 * @public
	 * @param {number} code
	 * @param {string} message
	 */
	public constructor(code: number, message: string) {
		super(message)

		this.name = "WebDAVError"
		this.code = code
		this.errno = code
	}
}

/**
 * Error handling middleware.
 *
 * @param {*} err
 * @param {*} req
 * @param {*} res
 * @returns {void}
 */
export const Errors: ErrorRequestHandler = (err, req, res): void => {
	res.status(err instanceof WebDAVError ? err.code : 500)
	res.set("Content-Length", "0")
	res.end("Internal server error")
}

export default Errors
