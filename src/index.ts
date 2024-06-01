import SDK, { type FilenSDKConfig } from "@filen/sdk"
import * as WebDAV from "@filen/webdav-server"
import FileSystem from "./filesystem"
import StorageManager from "./filesystem/storageManager"

process.removeAllListeners("warning")

export type WebDAVUser = {
	name: string
	password: string
	isAdmin: boolean
	rights?: WebDAV.BasicPrivilege[] | string[]
}

/**
 * WebDAVServer
 * @date 2/23/2024 - 5:50:56 AM
 *
 * @export
 * @class WebDAVServer
 * @typedef {WebDAVServer}
 */
export class WebDAVServer {
	private readonly sdk: SDK
	private readonly webdavServer: WebDAV.WebDAVServer
	private readonly rootPath: string = ""

	/**
	 * Creates an instance of WebDAVServer.
	 *
	 * @constructor
	 * @public
	 * @param {{
	 * 		users: WebDAVUser[]
	 * 		hostname?: string
	 * 		port?: number
	 * 		sdkConfig: FilenSDKConfig
	 * 		tmpDir?: string
	 * 		authType?: "basic" | "digest"
	 * 		rootPath?: string
	 * 	}} param0
	 * @param {{}} param0.users
	 * @param {string} param0.hostname
	 * @param {number} param0.port
	 * @param {FilenSDKConfig} param0.sdkConfig
	 * @param {string} param0.tmpDir
	 * @param {("basic" | "digest")} [param0.authType="basic"]
	 * @param {string} param0.rootPath
	 */
	public constructor({
		users,
		hostname,
		port,
		sdkConfig,
		tmpDir,
		authType = "basic",
		rootPath
	}: {
		users: WebDAVUser[]
		hostname?: string
		port?: number
		sdkConfig: FilenSDKConfig
		tmpDir?: string
		authType?: "basic" | "digest"
		rootPath?: string
	}) {
		if (rootPath && (!rootPath.includes("/") || !rootPath.startsWith("/"))) {
			throw new Error("Invalid root path.")
		}

		this.rootPath = rootPath ? rootPath : ""
		this.sdk = new SDK(sdkConfig)

		const userManager = new WebDAV.SimpleUserManager()
		const privilegeManager = new WebDAV.SimplePathPrivilegeManager()

		for (const user of users) {
			const usr = userManager.addUser(user.name, user.password, user.isAdmin)

			privilegeManager.setRights(usr, "/", user.rights ? user.rights : ["all"])
		}

		this.webdavServer = new WebDAV.WebDAVServer({
			hostname,
			privilegeManager,
			requireAuthentification: true,
			maxRequestDepth: Infinity,
			httpAuthentication:
				authType === "digest"
					? new WebDAV.HTTPDigestAuthentication(userManager, "Default realm")
					: new WebDAV.HTTPBasicAuthentication(userManager, "Default realm"),
			port: port ? port : 1901,
			rootFileSystem: new FileSystem({
				sdk: this.sdk,
				tmpDir,
				rootPath
			}),
			storageManager: new StorageManager({ sdk: this.sdk })
		})
	}

	/**
	 * Initialize the WebDAV worker.
	 * @date 2/23/2024 - 5:51:12 AM
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>}
	 */
	public async initialize(): Promise<void> {
		if (this.rootPath.length > 0 && this.rootPath.includes("/")) {
			try {
				await this.sdk.fs().stat({ path: this.rootPath })
			} catch {
				throw new Error("Root path not found.")
			}
		}

		await new Promise<void>(resolve => {
			this.webdavServer.start(() => {
				resolve()
			})
		})
	}
}

export default WebDAVServer
