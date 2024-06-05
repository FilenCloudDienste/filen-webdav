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
 * @param {*} next
 * @returns {void}
 */
export const Errors: ErrorRequestHandler = (err, req, res, next): void => {
	if (res.headersSent) {
		next(err)

		return
	}

	res.status(err instanceof WebDAVError ? err.code : 500)
		.set("Content-Length", "0")
		.end("Internal server error")
}

export default Errors
