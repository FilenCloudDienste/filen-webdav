import { type Response } from "express"
import { Builder } from "xml2js"
import { type Resource } from "."
import dayjs from "dayjs"
import mimeTypes from "mime-types"

/**
 * Responses
 *
 * @export
 * @class Responses
 * @typedef {Responses}
 */
export class Responses {
	public static readonly xmlBuilder = new Builder({
		xmldec: {
			version: "1.0",
			encoding: "utf-8"
		}
	})

	public static async propfind(res: Response, resources: Resource[], quota: { used: number; available: number }): Promise<void> {
		if (res.headersSent) {
			return
		}

		const response = this.xmlBuilder.buildObject({
			"D:multistatus": {
				$: {
					"xmlns:D": "DAV:"
				},
				"D:response": resources.map(resource => ({
					"D:href": `${encodeURI(resource.url)}`,
					["D:propstat"]: {
						"D:prop": {
							"D:getlastmodified": dayjs(resource.mtimeMs).format("ddd, DD MMM YYYY HH:mm:ss [GMT]"),
							"D:displayname": encodeURIComponent(resource.name),
							"D:getcontentlength": resource.type === "directory" ? 0 : resource.size,
							"D:getetag": resource.uuid,
							"D:creationdate": dayjs(resource.birthtimeMs).format("ddd, DD MMM YYYY HH:mm:ss [GMT]"),
							"D:quota-available-bytes": quota.available.toString(),
							"D:quota-used-bytes": quota.used.toString(),
							"D:getcontenttype":
								resource.type === "directory"
									? "httpd/unix-directory"
									: mimeTypes.lookup(resource.name) || "application/octet-stream",
							"D:resourcetype":
								resource.type === "directory"
									? {
											"D:collection": ""
									  }
									: {
											"D:file": ""
									  }
						},
						"D:status": "HTTP/1.1 200 OK"
					}
				}))
			}
		})

		res.set("Content-Type", "application/xml; charset=utf-8")
		res.set("Content-Length", Buffer.from(response, "utf-8").byteLength.toString())
		res.status(207)

		await new Promise<void>(resolve => {
			res.end(response, () => {
				resolve()
			})
		})
	}

	public static async proppatch(res: Response, url: string): Promise<void> {
		if (res.headersSent) {
			return
		}

		const response = this.xmlBuilder.buildObject({
			"D:multistatus": {
				$: {
					"xmlns:D": "DAV:"
				},
				"D:response": {
					"D:href": `${encodeURI(url)}`,
					["D:propstat"]: {
						"D:prop": {},
						"D:status": "HTTP/1.1 207 Multi-Status"
					}
				}
			}
		})

		res.set("Content-Type", "application/xml; charset=utf-8")
		res.set("Content-Length", Buffer.from(response, "utf-8").byteLength.toString())
		res.status(207)

		await new Promise<void>(resolve => {
			res.end(response, () => {
				resolve()
			})
		})
	}

	public static async notFound(res: Response, url: string): Promise<void> {
		if (res.headersSent) {
			return
		}

		const response = this.xmlBuilder.buildObject({
			"D:multistatus": {
				$: {
					"xmlns:D": "DAV:"
				},
				"D:response": {
					"D:href": `${encodeURI(url)}`,
					["D:propstat"]: {
						"D:prop": {},
						"D:status": "HTTP/1.1 404 NOT FOUND"
					}
				}
			}
		})

		res.set("Content-Type", "application/xml; charset=utf-8")
		res.set("Content-Length", Buffer.from(response, "utf-8").byteLength.toString())
		res.status(404)

		await new Promise<void>(resolve => {
			res.end(response, () => {
				resolve()
			})
		})
	}

	public static async badRequest(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(400)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async alreadyExists(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(403)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async created(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(201)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async ok(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(200)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async noContent(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(204)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async notImplemented(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(501)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async forbidden(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(403)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async internalError(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(500)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async notAuthorized(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(401)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}

	public static async preconditionFailed(res: Response): Promise<void> {
		if (res.headersSent) {
			return
		}

		res.set("Content-Length", "0")
		res.status(412)

		await new Promise<void>(resolve => {
			res.end(() => {
				resolve()
			})
		})
	}
}

export default Responses
