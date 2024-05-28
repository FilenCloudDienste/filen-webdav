import SDK from "@filen/sdk"
import * as WebDAV from "@filen/webdav-server"

export class StorageManager implements WebDAV.IStorageManager {
	public readonly sdk: SDK

	public constructor({ sdk }: { sdk: SDK }) {
		this.sdk = sdk
	}

	public reserve(ctx: WebDAV.RequestContext, fs: WebDAV.FileSystem, size: number, callback: (reserved: boolean) => void): void {
		callback(true)
	}

	public reserved(ctx: WebDAV.RequestContext, fs: WebDAV.FileSystem, callback: (reserved: number) => void): void {
		callback(0)
	}

	public async available(ctx: WebDAV.RequestContext, fs: WebDAV.FileSystem, callback: (available: number) => void): Promise<void> {
		try {
			const statfs = await this.sdk.fs().statfs()

			callback(statfs.max - statfs.used)
		} catch (e) {
			callback(0)
		}
	}

	public evaluateContent(
		ctx: WebDAV.RequestContext,
		fs: WebDAV.FileSystem,
		expectedSize: number,
		callback: WebDAV.IStorageManagerEvaluateCallback
	): void {
		callback(0)
	}

	public evaluateCreate(
		ctx: WebDAV.RequestContext,
		fs: WebDAV.FileSystem,
		path: WebDAV.Path,
		type: WebDAV.ResourceType,
		callback: WebDAV.IStorageManagerEvaluateCallback
	): void {
		callback(0)
	}

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
