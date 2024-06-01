import * as WebDAV from "@filen/webdav-server"
import FileSystem from "."
import type Resource from "./resource"
import type SDK from "@filen/sdk"

export type FileSystemSerializedData = {
	path: string
	resources: {
		[path: string]: Resource
	}
}

/**
 * Serializer
 *
 * @export
 * @class Serializer
 * @typedef {Serializer}
 * @implements {WebDAV.FileSystemSerializer}
 */
export class Serializer implements WebDAV.FileSystemSerializer {
	private readonly sdk: SDK

	/**
	 * Creates an instance of Serializer.
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
	 * uid
	 *
	 * @public
	 * @returns {string}
	 */
	public uid(): string {
		return "Serializer-1.0.0"
	}

	/**
	 * serialize
	 *
	 * @public
	 * @param {FileSystem} fs
	 * @param {WebDAV.ReturnCallback<FileSystemSerializedData>} callback
	 */
	public serialize(fs: FileSystem, callback: WebDAV.ReturnCallback<FileSystemSerializedData>): void {
		callback(undefined, {
			path: "",
			resources: {}
		})
	}

	/**
	 * unserialize
	 *
	 * @public
	 * @param {FileSystemSerializedData} serializedData
	 * @param {WebDAV.ReturnCallback<FileSystem>} callback
	 */
	public unserialize(serializedData: FileSystemSerializedData, callback: WebDAV.ReturnCallback<FileSystem>): void {
		const fs = new FileSystem({ sdk: this.sdk })

		fs.setSerializer(this)

		callback(undefined, fs)
	}
}

export default Serializer
