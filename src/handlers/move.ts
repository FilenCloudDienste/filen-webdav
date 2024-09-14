import { type Request, type Response } from "express"
import type Server from ".."
import Responses from "../responses"
import { removeLastSlash, pathToTempDiskFileId } from "../utils"
import pathModule from "path"
import fs from "fs-extra"

/**
 * Move
 *
 * @export
 * @class Move
 * @typedef {Move}
 */
export class Move {
	/**
	 * Creates an instance of Move.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Move a file or a directory to the destination chosen in the header.
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
				if (overwrite && destinationResource) {
					if (destinationResource.tempDiskId) {
						await fs.rm(pathModule.join(this.server.tempDiskPath, destinationResource.tempDiskId), {
							force: true,
							maxRetries: 60 * 10,
							recursive: true,
							retryDelay: 100
						})
					}

					if (!destinationResource.isVirtual) {
						await sdk.fs().unlink({
							path: destinationResource.path,
							permanent: true
						})
					}

					this.server.getVirtualFilesForUser(req.username)[destination] = {
						...resource,
						url: destination,
						path: destination,
						name: pathModule.posix.basename(destination)
					}

					delete this.server.getVirtualFilesForUser(req.username)[resource.path]

					await Responses.noContent(res)

					return
				}

				this.server.getVirtualFilesForUser(req.username)[destination] = {
					...resource,
					url: destination,
					path: destination,
					name: pathModule.posix.basename(destination)
				}

				delete this.server.getVirtualFilesForUser(req.username)[resource.path]

				await Responses.created(res)

				return
			}

			if (resource.tempDiskId) {
				const destinationTempDiskFileId = pathToTempDiskFileId(destination, req.username)

				if (overwrite && destinationResource) {
					if (destinationResource.tempDiskId) {
						await fs.rm(pathModule.join(this.server.tempDiskPath, destinationResource.tempDiskId), {
							force: true,
							maxRetries: 60 * 10,
							recursive: true,
							retryDelay: 100
						})
					}

					if (!destinationResource.isVirtual) {
						await sdk.fs().unlink({
							path: destinationResource.path,
							permanent: true
						})
					}

					await fs.rename(
						pathModule.join(this.server.tempDiskPath, resource.tempDiskId),
						pathModule.join(this.server.tempDiskPath, destinationTempDiskFileId)
					)

					this.server.getTempDiskFilesForUser(req.username)[destination] = {
						...resource,
						url: destination,
						path: destination,
						name: pathModule.posix.basename(destination),
						tempDiskId: destinationTempDiskFileId
					}

					delete this.server.getTempDiskFilesForUser(req.username)[resource.path]

					await Responses.noContent(res)

					return
				}

				await fs.rename(
					pathModule.join(this.server.tempDiskPath, resource.tempDiskId),
					pathModule.join(this.server.tempDiskPath, destinationTempDiskFileId)
				)

				this.server.getTempDiskFilesForUser(req.username)[destination] = {
					...resource,
					url: destination,
					path: destination,
					name: pathModule.posix.basename(destination),
					tempDiskId: destinationTempDiskFileId
				}

				delete this.server.getTempDiskFilesForUser(req.username)[resource.path]

				await Responses.created(res)

				return
			}

			if (overwrite && destinationResource) {
				await sdk.fs().unlink({
					path: destinationResource.path,
					permanent: false
				})

				await sdk.fs().rename({
					from: resource.path,
					to: destination
				})

				await Responses.noContent(res)

				return
			}

			await sdk.fs().rename({
				from: resource.path,
				to: destination
			})

			await Responses.created(res)
		} catch (e) {
			this.server.logger.log("error", e, "move")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Move
