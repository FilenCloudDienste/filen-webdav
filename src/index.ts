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
import https from "https"
import Certs from "./certs"
import body from "./middlewares/body"
import NodeCache from "node-cache"
import http, { type IncomingMessage, type ServerResponse } from "http"

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
 * @class WebDAVServer
 * @typedef {WebDAVServer}
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
	public readonly enableHTTPS: boolean
	public readonly cache: Record<string, NodeCache> = {}
	public serverInstance:
		| https.Server<typeof IncomingMessage, typeof ServerResponse>
		| http.Server<typeof IncomingMessage, typeof ServerResponse>
		| null = null

	/**
	 * Creates an instance of WebDAVServer.
	 *
	 * @constructor
	 * @public
	 * @param {{
	 * 		hostname?: string
	 * 		port?: number
	 * 		authMode?: "basic" | "digest"
	 * 		https?: boolean
	 * 		user?: {
	 * 			sdkConfig: FilenSDKConfig
	 * 			username: string
	 * 			password: string
	 * 		}
	 * 	}} param0
	 * @param {string} [param0.hostname="127.0.0.1"]
	 * @param {number} [param0.port=1900]
	 * @param {{ sdkConfig: FilenSDKConfig; username: string; password: string; }} param0.user
	 * @param {("basic" | "digest")} [param0.authMode="basic"]
	 * @param {boolean} [param0.https=false]
	 */
	public constructor({
		hostname = "127.0.0.1",
		port = 1900,
		user,
		authMode = "basic",
		https = false
	}: {
		hostname?: string
		port?: number
		authMode?: "basic" | "digest"
		https?: boolean
		user?: {
			sdkConfig: FilenSDKConfig
			username: string
			password: string
		}
	}) {
		this.enableHTTPS = https
		this.authMode = authMode
		this.serverConfig = {
			hostname,
			port
		}
		this.proxyMode = typeof user === "undefined"
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
				sdk: new FilenSDK({
					...user.sdkConfig,
					connectToSocket: true,
					metadataCache: true
				})
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
	 * Returns a NodeCache instance for each user.
	 *
	 * @public
	 * @param {?string} [username]
	 * @returns {NodeCache}
	 */
	public getCacheForUser(username?: string): NodeCache {
		if (!username) {
			return new NodeCache()
		}

		if (!this.cache[username]) {
			this.cache[username] = new NodeCache()
		}

		return this.cache[username]!
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
			res.set("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE")
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
				body(req, res, next)

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

		await new Promise<void>((resolve, reject) => {
			if (this.enableHTTPS) {
				Certs.get()
					.then(certs => {
						this.serverInstance = https
							.createServer(
								{
									cert: certs.cert,
									key: certs.privateKey
								},
								this.server
							)
							.listen(this.serverConfig.port, this.serverConfig.hostname, () => {
								resolve()
							})
					})
					.catch(reject)
			} else {
				this.serverInstance = http.createServer(this.server).listen(this.serverConfig.port, this.serverConfig.hostname, () => {
					resolve()
				})
			}
		})
	}

	/**
	 * Stop the server.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>}
	 */
	public async stop(): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			if (!this.serverInstance) {
				resolve()

				return
			}

			this.serverInstance.close(err => {
				if (err) {
					reject(err)

					return
				}

				resolve()
			})
		})
	}
}

export default WebDAVServer
