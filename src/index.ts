import express, { type Express, type Request } from "express"
import asyncHandler from "express-async-handler"
import Head from "./handlers/head"
import FilenSDK, { type FSStats, type FilenSDKConfig } from "@filen/sdk"
import Get from "./handlers/get"
import Errors from "./middlewares/errors"
import bodyParser from "body-parser"
import Options from "./handlers/options"
import Propfind from "./handlers/propfind"
import Put from "./handlers/put"
import Mkcol from "./handlers/mkcol"
import Delete from "./handlers/delete"
import Copy from "./handlers/copy"
import Proppatch from "./handlers/proppatch"
import Move from "./handlers/move"
import Auth from "./middlewares/auth"
import { removeLastSlash } from "./utils"
import Lock from "./handlers/lock"
import Unlock from "./handlers/unlock"
import { Semaphore, type ISemaphore } from "./semaphore"

export type ServerConfig = {
	hostname: string
	port: number
}

export type Resource = FSStats & {
	url: string
	path: string
	isVirtual: boolean
}

export type User = {
	sdk: FilenSDK
	username: string
	password: string
}

export type AuthMode = "basic" | "digest"

/**
 * WebDAVServer
 *
 * @export
 * @class Server
 * @typedef {Server}
 */
export class WebDAVServer {
	public readonly server: Express
	public readonly users: Record<string, User> = {}
	public readonly serverConfig: ServerConfig
	public readonly virtualFiles: Record<string, Record<string, Resource>> = {}
	public readonly proxyMode: boolean
	public readonly defaultUsername: string = ""
	public readonly defaultPassword: string = ""
	public readonly authMode: AuthMode
	public readonly rwMutex: Record<string, Record<string, ISemaphore>> = {}

	/**
	 * Creates an instance of WebDAVServer.
	 *
	 * @constructor
	 * @public
	 * @param {{
	 * 		hostname: string
	 * 		port: number
	 * 		authMode?: "basic" | "digest"
	 * 		user?: {
	 * 			sdkConfig: FilenSDKConfig
	 * 			username: string
	 * 			password: string
	 * 		}
	 * 	}} param0
	 * @param {string} param0.hostname
	 * @param {number} param0.port
	 * @param {{ sdkConfig: FilenSDKConfig; username: string; password: string; }} param0.user
	 * @param {("basic" | "digest")} [param0.authMode="basic"]
	 */
	public constructor({
		hostname,
		port,
		user,
		authMode = "basic"
	}: {
		hostname: string
		port: number
		authMode?: "basic" | "digest"
		user?: {
			sdkConfig: FilenSDKConfig
			username: string
			password: string
		}
	}) {
		this.authMode = authMode
		this.serverConfig = {
			hostname,
			port
		}
		this.proxyMode = user ? false : true
		this.server = express()

		if (this.proxyMode && this.authMode === "digest") {
			throw new Error("Digest authentication is not supported in proxy mode.")
		}

		if (user) {
			this.defaultUsername = user.username
			this.defaultPassword = user.password

			this.users[user.username] = {
				username: user.username,
				password: user.password,
				sdk: new FilenSDK(user.sdkConfig)
			}

			if (this.defaultUsername.length === 0 || this.defaultPassword.length === 0) {
				throw new Error("Username or password empty.")
			}
		}
	}

	/**
	 * Return all virtual file handles for the passed username.
	 *
	 * @public
	 * @param {?(string)} [username]
	 * @returns {Record<string, Resource>}
	 */
	public getVirtualFilesForUser(username?: string): Record<string, Resource> {
		if (!username) {
			return {}
		}

		if (this.virtualFiles[username]) {
			return this.virtualFiles[username]!
		}

		this.virtualFiles[username] = {}

		return this.virtualFiles[username]!
	}

	/**
	 * Return the FilenSDK instance for the passed username.
	 *
	 * @public
	 * @param {?(string)} [username]
	 * @returns {(FilenSDK | null)}
	 */
	public getSDKForUser(username?: string): FilenSDK | null {
		if (!username) {
			return null
		}

		if (this.users[username]) {
			return this.users[username]!.sdk
		}

		return null
	}

	/**
	 * Get the RW mutex for the given username and path.
	 *
	 * @public
	 * @param {string} path
	 * @param {?string} [username]
	 * @returns {ISemaphore}
	 */
	public getRWMutexForUser(path: string, username?: string): ISemaphore {
		path = removeLastSlash(decodeURI(path))

		if (!username) {
			return new Semaphore(1)
		}

		if (!this.rwMutex[username]) {
			this.rwMutex[username] = {}
		}

		if (this.rwMutex[username]![path]) {
			return this.rwMutex[username]![path]!
		}

		this.rwMutex[username]![path]! = new Semaphore(1)

		return this.rwMutex[username]![path]!
	}

	/**
	 * Get the WebDAV resource of the requested URL.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @returns {Promise<Resource | null>}
	 */
	public async urlToResource(req: Request): Promise<Resource | null> {
		const url = decodeURI(req.url)
		const path = url === "/" ? url : removeLastSlash(url)

		if (this.getVirtualFilesForUser(req.username)[path]) {
			return this.getVirtualFilesForUser(req.username)[path]!
		}

		const sdk = this.getSDKForUser(req.username)

		if (!sdk) {
			return null
		}

		try {
			const stat = await sdk.fs().stat({ path })

			return {
				...stat,
				url: `${path}${stat.type === "directory" && stat.uuid !== sdk.config.baseFolderUUID ? "/" : ""}`,
				path,
				isVirtual: false
			}
		} catch {
			return null
		}
	}

	/**
	 * Convert a FilenSDK style path to a WebDAV resource.
	 *
	 * @public
	 * @async
	 * @param {Request} req
	 * @param {string} path
	 * @returns {Promise<Resource | null>}
	 */
	public async pathToResource(req: Request, path: string): Promise<Resource | null> {
		if (this.getVirtualFilesForUser(req.username)[path]) {
			return this.getVirtualFilesForUser(req.username)[path]!
		}

		const sdk = this.getSDKForUser(req.username)

		if (!sdk) {
			return null
		}

		try {
			const stat = await sdk.fs().stat({ path: path === "/" ? path : removeLastSlash(path) })

			return {
				...stat,
				url: `${path}${stat.type === "directory" && stat.uuid !== sdk.config.baseFolderUUID ? "/" : ""}`,
				path,
				isVirtual: false
			}
		} catch {
			return null
		}
	}

	/**
	 * Start the server.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>}
	 */
	public async start(): Promise<void> {
		this.server.disable("x-powered-by")

		this.server.use(asyncHandler(new Auth(this).handle))

		this.server.use((_, res, next) => {
			res.set("Allow", "OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE")
			res.set("DAV", "1, 2")
			res.set("Access-Control-Allow-Origin", "*")
			res.set("Access-Control-Allow-Credentials", "true")
			res.set("Access-Control-Expose-Headers", "DAV, content-length, Allow")
			res.set("MS-Author-Via", "DAV")
			res.set("Server", "Filen WebDAV")
			res.set("Cache-Control", "no-cache")

			next()
		})

		this.server.use((req, res, next) => {
			const method = req.method.toUpperCase()

			if (method === "POST" || method === "PUT") {
				next()

				return
			}

			bodyParser.text({ type: ["application/xml", "text/xml"] })(req, res, next)
		})

		this.server.head("*", asyncHandler(new Head(this).handle))
		this.server.get("*", asyncHandler(new Get(this).handle))
		this.server.options("*", asyncHandler(new Options().handle))
		this.server.propfind("*", asyncHandler(new Propfind(this).handle))
		this.server.put("*", asyncHandler(new Put(this).handle))
		this.server.post("*", asyncHandler(new Put(this).handle))
		this.server.mkcol("*", asyncHandler(new Mkcol(this).handle))
		this.server.delete("*", asyncHandler(new Delete(this).handle))
		this.server.copy("*", asyncHandler(new Copy(this).handle))
		this.server.lock("*", asyncHandler(new Lock().handle))
		this.server.unlock("*", asyncHandler(new Unlock().handle))
		this.server.proppatch("*", asyncHandler(new Proppatch().handle))
		this.server.move("*", asyncHandler(new Move(this).handle))

		this.server.use(Errors)

		await new Promise<void>(resolve => {
			this.server.listen(this.serverConfig.port, this.serverConfig.hostname, () => {
				resolve()
			})
		})
	}
}

export default WebDAVServer
