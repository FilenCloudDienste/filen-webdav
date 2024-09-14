import express, { type Express, type Request } from "express"
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
import Auth, { parseDigestAuthHeader } from "./middlewares/auth"
import { removeLastSlash, tempDiskPath } from "./utils"
import Lock from "./handlers/lock"
import Unlock from "./handlers/unlock"
import { Semaphore, type ISemaphore } from "./semaphore"
import https from "https"
import Certs from "./certs"
import body from "./middlewares/body"
import NodeCache from "node-cache"
import http, { type IncomingMessage, type ServerResponse } from "http"
import { type Socket } from "net"
import { v4 as uuidv4 } from "uuid"
import { type Duplex } from "stream"
import { rateLimit } from "express-rate-limit"
import Logger from "./logger"
import cluster from "cluster"
import os from "os"
// @ts-expect-error Picomatch exports wrong types
import picomatch from "picomatch/posix"
import { type Matcher } from "picomatch"
import fs from "fs-extra"

export type ServerConfig = {
	hostname: string
	port: number
}

export type Resource = FSStats & {
	url: string
	path: string
	isVirtual: boolean
	tempDiskId?: string
}

export type User = {
	sdkConfig?: FilenSDKConfig
	sdk?: FilenSDK
	username: string
	password: string
}

export type AuthMode = "basic" | "digest"

export type RateLimit = {
	windowMs: number
	limit: number
	key: "ip" | "username"
}

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
	public readonly tempDiskFiles: Record<string, Record<string, Resource>> = {}
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
	public connections: Record<string, Socket | Duplex> = {}
	public readonly rateLimit: RateLimit
	public readonly logger: Logger
	public readonly tempDiskPath: string
	public readonly putMatcher: Matcher | null

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
	 * 		user?: User
	 * 		rateLimit?: RateLimit
	 * 		disableLogging?: boolean
	 * 		tempFilesToStoreOnDisk?: string[]
	 * 	}} param0
	 * @param {string} [param0.hostname="127.0.0.1"]
	 * @param {number} [param0.port=1900]
	 * @param {User} param0.user
	 * @param {("basic" | "digest")} [param0.authMode="basic"]
	 * @param {boolean} [param0.https=false]
	 * @param {RateLimit} [param0.rateLimit={
	 * 			windowMs: 1000,
	 * 			limit: 1000,
	 * 			key: "username"
	 * 		}]
	 * @param {boolean} [param0.disableLogging=false]
	 * @param {{}} [param0.tempFilesToStoreOnDisk=[]] Glob patterns of files that should not be uploaded to the cloud. Files matching the pattern will be served locally.
	 */
	public constructor({
		hostname = "127.0.0.1",
		port = 1900,
		user,
		authMode = "basic",
		https = false,
		rateLimit = {
			windowMs: 1000,
			limit: 1000,
			key: "username"
		},
		disableLogging = false,
		tempFilesToStoreOnDisk = []
	}: {
		hostname?: string
		port?: number
		authMode?: "basic" | "digest"
		https?: boolean
		user?: User
		rateLimit?: RateLimit
		disableLogging?: boolean
		tempFilesToStoreOnDisk?: string[]
	}) {
		this.enableHTTPS = https
		this.authMode = authMode
		this.rateLimit = rateLimit
		this.serverConfig = {
			hostname,
			port
		}
		this.proxyMode = typeof user === "undefined"
		this.server = express()
		this.logger = new Logger(disableLogging, false)
		this.tempDiskPath = tempDiskPath()
		this.putMatcher = tempFilesToStoreOnDisk.length > 0 ? picomatch(tempFilesToStoreOnDisk) : null

		if (this.proxyMode && this.authMode === "digest") {
			throw new Error("Digest authentication is not supported in proxy mode.")
		}

		if (user) {
			if (!user.sdk && !user.sdkConfig) {
				throw new Error("Either pass a configured SDK instance OR a SDKConfig object to the user object.")
			}

			this.defaultUsername = user.username
			this.defaultPassword = user.password

			this.users[user.username] = {
				username: user.username,
				password: user.password,
				sdk: user.sdk
					? user.sdk
					: new FilenSDK({
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
	 * Return all temp disk file handles for the passed username.
	 *
	 * @public
	 * @param {?string} [username]
	 * @returns {Record<string, Resource>}
	 */
	public getTempDiskFilesForUser(username?: string): Record<string, Resource> {
		if (!username) {
			return {}
		}

		if (this.tempDiskFiles[username]) {
			return this.tempDiskFiles[username]!
		}

		this.tempDiskFiles[username] = {}

		return this.tempDiskFiles[username]!
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

		if (this.users[username] && this.users[username]!.sdk) {
			return this.users[username]!.sdk!
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

		if (this.getTempDiskFilesForUser(req.username)[path]) {
			return this.getTempDiskFilesForUser(req.username)[path]!
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

		if (this.getTempDiskFilesForUser(req.username)[path]) {
			return this.getTempDiskFilesForUser(req.username)[path]!
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
		this.connections = {}

		this.server.disable("x-powered-by")

		this.server.use(
			rateLimit({
				windowMs: this.rateLimit.windowMs,
				limit: this.rateLimit.limit,
				standardHeaders: "draft-7",
				legacyHeaders: true,
				keyGenerator: req => {
					if (this.rateLimit.key === "ip") {
						return req.ip ?? "ip"
					}

					if (this.authMode === "digest") {
						const authHeader = req.headers["authorization"]

						if (!authHeader || !authHeader.startsWith("Digest ")) {
							return req.ip ?? "ip"
						}

						const authParams = parseDigestAuthHeader(authHeader.slice(7))
						const username = authParams.username

						if (!username || !authParams.response) {
							return req.ip ?? "ip"
						}

						return username
					} else {
						const authHeader = req.headers["authorization"]

						if (!authHeader || !authHeader.startsWith("Basic ")) {
							return req.ip ?? "ip"
						}

						const base64Credentials = authHeader.split(" ")[1]

						if (!base64Credentials) {
							return req.ip ?? "ip"
						}

						const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8")
						const [username, password] = credentials.split(":")

						if (!username || !password) {
							return req.ip ?? "ip"
						}

						return username
					}
				}
			})
		)

		this.server.use(new Auth(this).handle)

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

		this.server.head("*", new Head(this).handle)
		this.server.get("*", new Get(this).handle)
		this.server.options("*", new Options(this).handle)
		this.server.propfind("*", new Propfind(this).handle)
		this.server.put("*", new Put(this).handle)
		this.server.post("*", new Put(this).handle)
		this.server.mkcol("*", new Mkcol(this).handle)
		this.server.delete("*", new Delete(this).handle)
		this.server.copy("*", new Copy(this).handle)
		this.server.lock("*", new Lock(this).handle)
		this.server.unlock("*", new Unlock(this).handle)
		this.server.proppatch("*", new Proppatch(this).handle)
		this.server.move("*", new Move(this).handle)

		this.server.use(Errors)

		await fs.emptyDir(this.tempDiskPath)

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
							.on("connection", socket => {
								const socketId = uuidv4()

								this.connections[socketId] = socket

								socket.once("close", () => {
									delete this.connections[socketId]
								})
							})
					})
					.catch(reject)
			} else {
				this.serverInstance = http
					.createServer(this.server)
					.listen(this.serverConfig.port, this.serverConfig.hostname, () => {
						resolve()
					})
					.on("connection", socket => {
						const socketId = uuidv4()

						this.connections[socketId] = socket

						socket.once("close", () => {
							delete this.connections[socketId]
						})
					})
			}
		})
	}

	/**
	 * Stop the server.
	 *
	 * @public
	 * @async
	 * @param {boolean} [terminate=false]
	 * @returns {Promise<void>}
	 */
	public async stop(terminate: boolean = false): Promise<void> {
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

			if (terminate) {
				for (const socketId in this.connections) {
					try {
						this.connections[socketId]?.destroy()

						delete this.connections[socketId]
					} catch {
						// Noop
					}
				}
			}
		})
	}
}

/**
 * WebDAVServerCluster
 *
 * @export
 * @class WebDAVServerCluster
 * @typedef {WebDAVServerCluster}
 */
export class WebDAVServerCluster {
	private enableHTTPS: boolean
	private authMode: AuthMode
	private rateLimit: RateLimit
	private serverConfig: ServerConfig
	private proxyMode: boolean
	private user:
		| {
				sdkConfig?: FilenSDKConfig
				sdk?: FilenSDK
				username: string
				password: string
		  }
		| undefined
	private threads: number
	private workers: Record<
		number,
		{
			worker: ReturnType<typeof cluster.fork>
			ready: boolean
		}
	> = {}
	private stopSpawning: boolean = false
	private tempFilesToStoreOnDisk: string[]

	/**
	 * Creates an instance of WebDAVServerCluster.
	 *
	 * @constructor
	 * @public
	 * @param {{
	 * 		hostname?: string
	 * 		port?: number
	 * 		authMode?: "basic" | "digest"
	 * 		https?: boolean
	 * 		user?: {
	 * 			sdkConfig?: FilenSDKConfig
	 * 			sdk?: FilenSDK
	 * 			username: string
	 * 			password: string
	 * 		}
	 * 		rateLimit?: RateLimit
	 * 		disableLogging?: boolean
	 * 		threads?: number
	 * 		tempFilesToStoreOnDisk?: string[]
	 * 	}} param0
	 * @param {string} [param0.hostname="127.0.0.1"]
	 * @param {number} [param0.port=1900]
	 * @param {{ sdkConfig?: FilenSDKConfig; sdk?: FilenSDK; username: string; password: string; }} param0.user
	 * @param {("basic" | "digest")} [param0.authMode="basic"]
	 * @param {boolean} [param0.https=false]
	 * @param {RateLimit} [param0.rateLimit={
	 * 			windowMs: 1000,
	 * 			limit: 1000,
	 * 			key: "username"
	 * 		}]
	 * @param {number} param0.threads
	 * @param {{}} [param0.tempFilesToStoreOnDisk=[]] Glob patterns of files that should not be uploaded to the cloud. Files matching the pattern will be served locally.
	 */
	public constructor({
		hostname = "127.0.0.1",
		port = 1900,
		user,
		authMode = "basic",
		https = false,
		rateLimit = {
			windowMs: 1000,
			limit: 1000,
			key: "username"
		},
		threads,
		tempFilesToStoreOnDisk = []
	}: {
		hostname?: string
		port?: number
		authMode?: "basic" | "digest"
		https?: boolean
		user?: {
			sdkConfig?: FilenSDKConfig
			sdk?: FilenSDK
			username: string
			password: string
		}
		rateLimit?: RateLimit
		disableLogging?: boolean
		threads?: number
		tempFilesToStoreOnDisk?: string[]
	}) {
		this.enableHTTPS = https
		this.authMode = authMode
		this.rateLimit = rateLimit
		this.serverConfig = {
			hostname,
			port
		}
		this.proxyMode = typeof user === "undefined"
		this.threads = typeof threads === "number" ? threads : os.cpus().length
		this.user = user
		this.tempFilesToStoreOnDisk = tempFilesToStoreOnDisk

		if (this.proxyMode && this.authMode === "digest") {
			throw new Error("Digest authentication is not supported in proxy mode.")
		}

		if (this.user) {
			if (!this.user.sdk && !this.user.sdkConfig) {
				throw new Error("Either pass a configured SDK instance OR a SDKConfig object to the user object.")
			}

			if (this.user.username.length === 0 || this.user.password.length === 0) {
				throw new Error("Username or password empty.")
			}
		}
	}

	/**
	 * Spawn a worker.
	 *
	 * @private
	 */
	private spawnWorker(): void {
		if (this.stopSpawning) {
			return
		}

		const worker = cluster.fork()

		this.workers[worker.id] = {
			worker,
			ready: false
		}
	}

	/**
	 * Fork all needed threads.
	 *
	 * @private
	 * @async
	 * @returns {Promise<"master" | "worker">}
	 */
	private async startCluster(): Promise<"master" | "worker"> {
		if (cluster.isPrimary) {
			return await new Promise<"master" | "worker">((resolve, reject) => {
				try {
					let workersReady = 0

					for (let i = 0; i < this.threads; i++) {
						this.spawnWorker()
					}

					cluster.on("exit", async worker => {
						if (workersReady < this.threads) {
							return
						}

						workersReady--

						delete this.workers[worker.id]

						await new Promise<void>(resolve => setTimeout(resolve, 1000))

						try {
							this.spawnWorker()
						} catch {
							// Noop
						}
					})

					const errorTimeout = setTimeout(() => {
						reject(new Error("Could not spawn all workers."))
					}, 15000)

					cluster.on("message", (worker, message) => {
						if (message === "ready" && this.workers[worker.id]) {
							workersReady++

							this.workers[worker.id]!.ready = true

							if (workersReady >= this.threads) {
								clearTimeout(errorTimeout)

								resolve("master")
							}
						}
					})
				} catch (e) {
					reject(e)
				}
			})
		}

		const server = new WebDAVServer({
			hostname: this.serverConfig.hostname,
			port: this.serverConfig.port,
			authMode: this.authMode,
			disableLogging: true,
			user: this.user,
			rateLimit: this.rateLimit,
			https: this.enableHTTPS,
			tempFilesToStoreOnDisk: this.tempFilesToStoreOnDisk
		})

		await server.start()

		if (process.send) {
			process.send("ready")
		}

		return "worker"
	}

	/**
	 * Start the WebDAV cluster.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>}
	 */
	public async start(): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			this.startCluster()
				.then(type => {
					if (type === "master") {
						resolve()
					}
				})
				.catch(reject)
		})
	}

	/**
	 * Stop the WebDAV cluster.
	 *
	 * @public
	 * @async
	 * @returns {Promise<void>}
	 */
	public async stop(): Promise<void> {
		cluster.removeAllListeners()

		this.stopSpawning = true

		for (const id in this.workers) {
			this.workers[id]!.worker.destroy()
		}

		await new Promise<void>(resolve => setTimeout(resolve, 1000))

		this.workers = {}
		this.stopSpawning = false
	}
}

export default WebDAVServer
