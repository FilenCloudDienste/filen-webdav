import { type Request, type Response } from "express"
import type Server from ".."
import Responses from "../responses"
import { removeLastSlash } from "../utils"
import pathModule from "path"

/**
 * Copy
 *
 * @export
 * @class Copy
 * @typedef {Copy}
 */
export class Copy {
	/**
	 * Creates an instance of Copy.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Copy a resource to the destination defined in the destination header. Overwrite if needed.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response): Promise<void> {
		try {
			const destinationHeader = req.headers["destination"]
			const overwrite = req.headers["overwrite"] === "T"

			if (
				typeof destinationHeader !== "string" ||
				!destinationHeader.includes(req.hostname) ||
				!destinationHeader.includes(req.protocol)
			) {
				await Responses.badRequest(res)

				return
			}

			let url: URL | null

			try {
				url = new URL(destinationHeader)
			} catch {
				await Responses.badRequest(res)

				return
			}

			if (!url) {
				await Responses.badRequest(res)

				return
			}

			const destination = decodeURI(url.pathname)

			if (destination.startsWith("..") || destination.startsWith("./") || destination.startsWith("../")) {
				await Responses.forbidden(res)

				return
			}

			const [resource, destinationResource] = await Promise.all([
				this.server.urlToResource(req),
				this.server.pathToResource(req, removeLastSlash(destination))
			])

			if (!resource) {
				await Responses.notFound(res, req.url)

				return
			}

			if (resource.path === destination) {
				await Responses.created(res)

				return
			}

			if (!overwrite && destinationResource) {
				await Responses.alreadyExists(res)

				return
			}

			const sdk = this.server.getSDKForUser(req.username)

			if (!sdk) {
				await Responses.notAuthorized(res)

				return
			}

			if (resource.isVirtual) {
				if (overwrite && destinationResource && !destinationResource.isVirtual) {
					await sdk.fs().unlink({
						path: destinationResource.path,
						permanent: true
					})

					this.server.getVirtualFilesForUser(req.username)[destination] = {
						...resource,
						url: destination,
						path: destination,
						name: pathModule.posix.basename(destination)
					}

					await Responses.noContent(res)

					return
				}

				this.server.getVirtualFilesForUser(req.username)[destination] = {
					...resource,
					url: destination,
					path: destination,
					name: pathModule.posix.basename(destination)
				}

				await Responses.created(res)

				return
			}

			if (overwrite && destinationResource) {
				await sdk.fs().unlink({
					path: destinationResource.path,
					permanent: false
				})

				await sdk.fs().cp({
					from: resource.path,
					to: destination
				})

				await Responses.noContent(res)

				return
			}

			await sdk.fs().cp({
				from: resource.path,
				to: destination
			})

			await Responses.created(res)
		} catch {
			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Copy
