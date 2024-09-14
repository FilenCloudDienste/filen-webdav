import { type Request, type Response } from "express"
import type Server from ".."
import Responses from "../responses"
import fs from "fs-extra"
import pathModule from "path"

/**
 * Delete
 *
 * @export
 * @class Delete
 * @typedef {Delete}
 */
export class Delete {
	/**
	 * Creates an instance of Delete.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	/**
	 * Delete a file or a directory.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response): Promise<void> {
		try {
			const resource = await this.server.urlToResource(req)

			if (!resource) {
				await Responses.notFound(res, req.url)

				return
			}

			if (resource.isVirtual) {
				delete this.server.getVirtualFilesForUser(req.username)[resource.path]

				await Responses.ok(res)

				return
			}

			if (resource.tempDiskId) {
				await fs.rm(pathModule.join(this.server.tempDiskPath, resource.tempDiskId), {
					force: true,
					maxRetries: 60 * 10,
					recursive: true,
					retryDelay: 100
				})

				delete this.server.getTempDiskFilesForUser(req.username)[resource.path]

				await Responses.ok(res)

				return
			}

			const sdk = this.server.getSDKForUser(req.username)

			if (!sdk) {
				await Responses.notAuthorized(res)

				return
			}

			await sdk.fs().unlink({
				path: resource.path,
				permanent: false
			})

			await Responses.ok(res)
		} catch (e) {
			this.server.logger.log("error", e, "delete")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Delete
