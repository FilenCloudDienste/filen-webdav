import { type Request, type Response } from "express"
import type Server from ".."
import Responses from "../responses"
import pathModule from "path"
import { promiseAllChunked } from "../utils"
import { type StatFS, type FilenSDK } from "@filen/sdk"

/**
 * Propfind
 *
 * @export
 * @class Propfind
 * @typedef {Propfind}
 */
export class Propfind {
	/**
	 * Creates an instance of Propfind.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

	public async statfs(req: Request, sdk: FilenSDK): Promise<StatFS> {
		const cache = this.server.getCacheForUser(req.username)
		const get = cache.get<StatFS>("statfs")

		if (get) {
			return get
		}

		const stat = await sdk.fs().statfs()

		cache.set<StatFS>("statfs", stat, 60)

		return stat
	}

	/**
	 * List a file or a directory and it's children.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {Response} res
	 * @returns {Promise<void>}
	 */
	public async handle(req: Request, res: Response): Promise<void> {
		try {
			const depth = req.header("depth") ?? "1"
			const resource = await this.server.urlToResource(req)

			if (!resource) {
				await Responses.notFound(res, req.url)

				return
			}

			const sdk = this.server.getSDKForUser(req.username)

			if (!sdk) {
				await Responses.notAuthorized(res)

				return
			}

			const statfs = await this.statfs(req, sdk)

			if (resource.type === "directory" && depth !== "0") {
				const content = await sdk.fs().readdir({ path: resource.url })
				const contentIncludingStats = await promiseAllChunked(
					content.map(item => sdk.fs().stat({ path: pathModule.posix.join(resource.url, item) }))
				)

				for (const path in this.server.getVirtualFilesForUser(req.username)) {
					const parentPath = pathModule.dirname(path)

					if (parentPath === resource.path || parentPath === resource.url) {
						contentIncludingStats.push(this.server.getVirtualFilesForUser(req.username)[path]!)
					}
				}

				for (const path in this.server.getTempDiskFilesForUser(req.username)) {
					const parentPath = pathModule.dirname(path)

					if (parentPath === resource.path || parentPath === resource.url) {
						contentIncludingStats.push(this.server.getTempDiskFilesForUser(req.username)[path]!)
					}
				}

				await Responses.propfind(
					res,
					[
						resource,
						...contentIncludingStats.map(item => ({
							...item,
							path: pathModule.posix.join(resource.path, item.name),
							url: `${pathModule.posix.join(resource.path, item.name)}${item.type === "directory" ? "/" : ""}`,
							isVirtual: false
						}))
					],
					{
						available: (statfs.max - statfs.used) * 1,
						used: statfs.used * 1
					}
				)

				return
			}

			await Responses.propfind(
				res,
				[
					{
						...resource,
						url: `${resource.url}${resource.type === "directory" && !resource.url.endsWith("/") ? "/" : ""}`
					}
				],
				{
					available: (statfs.max - statfs.used) * 1,
					used: statfs.used * 1
				}
			)
		} catch (e) {
			this.server.logger.log("error", e, "propfind")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Propfind
