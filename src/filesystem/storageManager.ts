import SDK from "@filen/sdk"
import * as WebDAV from "@filen/webdav-server"

/**
 * StorageManager
 *
 * @export
 * @class StorageManager
 * @typedef {StorageManager}
 * @implements {WebDAV.IStorageManager}
 */
export class StorageManager implements WebDAV.IStorageManager {
	public readonly sdk: SDK

	/**
	 * Creates an instance of StorageManager.
	 *
	 * @constructor
	 * @public
	 * @param {{ sdk: SDK }} param0
	 * @param {SDK} param0.sdk
	 */
	public constructor({ sdk }: { sdk: SDK }) {
		this.sdk = sdk
	}

	/**
	 * Reserve bytes.
	 *
	 * @public
	 * @param {WebDAV.RequestContext} ctx
	 * @param {WebDAV.FileSystem} fs
	 * @param {number} size
	 * @param {(reserved: boolean) => void} callback
	 */
	public reserve(ctx: WebDAV.RequestContext, fs: WebDAV.FileSystem, size: number, callback: (reserved: boolean) => void): void {
		callback(true)
	}

	/**
	 * Fetch how many bytes are reserved.
	 *
	 * @public
	 * @param {WebDAV.RequestContext} ctx
	 * @param {WebDAV.FileSystem} fs
	 * @param {(reserved: number) => void} callback
	 */
	public reserved(ctx: WebDAV.RequestContext, fs: WebDAV.FileSystem, callback: (reserved: number) => void): void {
		callback(0)
	}

	/**
	 * Fetch how much bytes are available on the account.
	 *
	 * @public
	 * @async
	 * @param {WebDAV.RequestContext} ctx
	 * @param {WebDAV.FileSystem} fs
	 * @param {(available: number) => void} callback
	 * @returns {Promise<void>}
	 */
	public async available(ctx: WebDAV.RequestContext, fs: WebDAV.FileSystem, callback: (available: number) => void): Promise<void> {
		try {
			const statfs = await this.sdk.fs().statfs()

			callback(statfs.max - statfs.used)
		} catch (e) {
			callback(0)
		}
	}

	/**
	 * Evaluate content size.
	 *
	 * @public
	 * @param {WebDAV.RequestContext} ctx
	 * @param {WebDAV.FileSystem} fs
	 * @param {number} expectedSize
	 * @param {WebDAV.IStorageManagerEvaluateCallback} callback
	 */
	public evaluateContent(
		ctx: WebDAV.RequestContext,
		fs: WebDAV.FileSystem,
		expectedSize: number,
		callback: WebDAV.IStorageManagerEvaluateCallback
	): void {
		callback(0)
	}

	/**
	 * Evaluate content create size.
	 *
	 * @public
	 * @param {WebDAV.RequestContext} ctx
	 * @param {WebDAV.FileSystem} fs
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.ResourceType} type
	 * @param {WebDAV.IStorageManagerEvaluateCallback} callback
	 */
	public evaluateCreate(
		ctx: WebDAV.RequestContext,
		fs: WebDAV.FileSystem,
		path: WebDAV.Path,
		type: WebDAV.ResourceType,
		callback: WebDAV.IStorageManagerEvaluateCallback
	): void {
		callback(0)
	}

	/**
	 * Evaluate property size.
	 *
	 * @public
	 * @param {WebDAV.RequestContext} ctx
	 * @param {WebDAV.FileSystem} fs
	 * @param {string} name
	 * @param {WebDAV.ResourcePropertyValue} value
	 * @param {WebDAV.PropertyAttributes} attributes
	 * @param {WebDAV.IStorageManagerEvaluateCallback} callback
	 */
	public evaluateProperty(
		ctx: WebDAV.RequestContext,
		fs: WebDAV.FileSystem,
		name: string,
		value: WebDAV.ResourcePropertyValue,
		attributes: WebDAV.PropertyAttributes,
		callback: WebDAV.IStorageManagerEvaluateCallback
	): void {
		callback(0)
	}
}

export default StorageManager
