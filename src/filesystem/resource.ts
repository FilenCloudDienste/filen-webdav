import * as WebDAV from "@filen/webdav-server"

/**
 * Resource
 *
 * @export
 * @class Resource
 * @typedef {Resource}
 */
export class Resource {
	private readonly type: WebDAV.ResourceType
	private readonly propertyManager: WebDAV.LocalPropertyManager
	private readonly lockManager: WebDAV.LocalLockManager
	private readonly creationDate: number
	private readonly lastModifiedDate: number
	private readonly uid?: string

	/**
	 * Creates an instance of Resource.
	 *
	 * @constructor
	 * @public
	 * @param {Resource} data
	 */
	public constructor(data: Resource) {
		this.type = data.type
		this.propertyManager = new WebDAV.LocalPropertyManager(data.propertyManager)
		this.creationDate = data.creationDate ?? Date.now()
		this.lastModifiedDate = data.lastModifiedDate ?? this.creationDate
		this.uid = data.uid
		this.lockManager = new WebDAV.LocalLockManager()
	}
}

export default Resource
