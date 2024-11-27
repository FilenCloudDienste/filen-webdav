import { type Request, type Response } from "express"
import Responses from "../responses"
import type Server from ".."
import { parseStringPromise } from "xml2js"
import { isValidDate, removeLastSlash } from "../utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractSetProperties(parsedXml: any): { [key: string]: string | null } {
	const properties: { [key: string]: string | null } = {}

	// Ensure the root and "d:set" structure exist, with case-insensitive handling for namespaces
	if (!parsedXml || !parsedXml["d:propertyupdate"]) {
		return properties
	}

	const propertyUpdate = parsedXml["d:propertyupdate"]
	const setSection = propertyUpdate["d:set"] || propertyUpdate["D:set"]

	if (!setSection || (!setSection["d:prop"] && !setSection["D:prop"])) {
		return properties
	}

	const propSection = setSection["d:prop"] || setSection["D:prop"]
	const propEntries = Array.isArray(propSection) ? propSection : [propSection]

	for (const prop of propEntries) {
		for (const key in prop) {
			// Skip non-property keys or metadata
			if (key.startsWith("_") || key === "$") {
				continue
			}

			// Handle namespaces (e.g., "d:property1" becomes "property1")
			const cleanKey = key.split(":").pop() || key

			// Extract value, considering multiple possible formats
			const value = typeof prop[key] === "string" ? prop[key] : prop[key]?._text || prop[key]?._ || null

			properties[cleanKey] = value
		}
	}

	return properties
}

/**
 * Proppatch
 *
 * @export
 * @class Proppatch
 * @typedef {Proppatch}
 */
export class Proppatch {
	/**
	 * Creates an instance of Proppatch.
	 *
	 * @constructor
	 * @public
	 * @param {Server} server
	 */
	public constructor(private readonly server: Server) {
		this.handle = this.handle.bind(this)
	}

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
			const path = removeLastSlash(decodeURIComponent(req.url))
			const resource = await this.server.urlToResource(req)

			if (!resource) {
				await Responses.notFound(res, req.url)

				return
			}

			if (resource.type !== "file") {
				await Responses.proppatch(res, req.url)

				return
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const parsed: Record<any, any> = await parseStringPromise(req.body, {
				trim: true,
				normalize: true,
				normalizeTags: true,
				explicitArray: false
			})

			const properties = extractSetProperties(parsed)
			let lastModified: number | undefined
			let creation: number | undefined

			if (
				!lastModified &&
				properties["getlastmodified"] &&
				typeof properties["getlastmodified"] === "string" &&
				isValidDate(properties["getlastmodified"])
			) {
				lastModified = new Date(properties["getlastmodified"]).getTime()
			}

			if (
				!lastModified &&
				properties["lastmodified"] &&
				typeof properties["lastmodified"] === "string" &&
				isValidDate(properties["lastmodified"])
			) {
				lastModified = new Date(properties["lastmodified"]).getTime()
			}

			if (
				!creation &&
				properties["creationdate"] &&
				typeof properties["creationdate"] === "string" &&
				isValidDate(properties["creationdate"])
			) {
				creation = new Date(properties["creationdate"]).getTime()
			}

			if (
				!creation &&
				properties["getcreationdate"] &&
				typeof properties["getcreationdate"] === "string" &&
				isValidDate(properties["getcreationdate"])
			) {
				creation = new Date(properties["getcreationdate"]).getTime()
			}

			if (!lastModified && !creation) {
				await Responses.proppatch(res, req.url)

				return
			}

			if (resource.isVirtual) {
				const current = this.server.getVirtualFilesForUser(req.username)[path]

				if (current && current.type === "file") {
					this.server.getVirtualFilesForUser(req.username)[path] = {
						...current,
						lastModified: lastModified ? lastModified : current.lastModified,
						creation: creation ? creation : current.creation
					}
				}
			} else if (resource.tempDiskId) {
				const current = this.server.getTempDiskFilesForUser(req.username)[path]

				if (current && current.type === "file") {
					this.server.getTempDiskFilesForUser(req.username)[path] = {
						...current,
						lastModified: lastModified ? lastModified : current.lastModified,
						creation: creation ? creation : current.creation
					}
				}
			} else {
				const sdk = this.server.getSDKForUser(req.username)

				if (!sdk) {
					await Responses.notAuthorized(res)

					return
				}

				await sdk.cloud().editFileMetadata({
					uuid: resource.uuid,
					metadata: {
						name: resource.name,
						key: resource.key,
						lastModified: lastModified ? lastModified : resource.lastModified,
						creation: creation ? creation : resource.creation,
						hash: resource.hash,
						size: resource.size,
						mime: resource.mime
					}
				})

				await sdk.fs()._removeItem({ path })
				await sdk.fs()._addItem({
					path,
					item: {
						type: "file",
						uuid: resource.uuid,
						metadata: {
							name: resource.name,
							size: resource.size,
							lastModified: lastModified ? lastModified : resource.lastModified,
							creation: creation ? creation : resource.creation,
							hash: resource.hash,
							key: resource.key,
							bucket: resource.bucket,
							region: resource.region,
							version: resource.version,
							chunks: resource.chunks,
							mime: resource.mime
						}
					}
				})
			}

			await Responses.proppatch(res, req.url)
		} catch (e) {
			this.server.logger.log("error", e, "proppatch")
			this.server.logger.log("error", e)

			Responses.internalError(res).catch(() => {})
		}
	}
}

export default Proppatch
