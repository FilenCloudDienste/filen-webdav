import SDK, { FSStats } from "@filen/sdk"
import * as WebDAV from "@filen/webdav-server"
import Serializer from "./serializer"
import { Readable, Writable } from "stream"
import PropertyManager from "./ops/propertyManager"
import LockManager from "./ops/lockManager"
import Type from "./ops/type"
import ReadDir from "./ops/readDir"
import DisplayName from "./ops/displayName"
import CreationDate from "./ops/creationDate"
import LastModifiedDate from "./ops/lastModifiedDate"
import Size from "./ops/size"
import MimeType from "./ops/mimeType"
import ETag from "./ops/etag"
import FastExistsCheck from "./ops/fastExistsCheck"
import Copy from "./ops/copy"
import Move from "./ops/move"
import Rename from "./ops/rename"
import Delete from "./ops/delete"
import Create from "./ops/create"
import OpenWriteStream from "./ops/openWriteStream"
import OpenReadStream from "./ops/openReadStream"
import os from "os"
import { ISemaphore, Semaphore } from "../semaphore"
import pathModule from "path"

/**
 * FileSystem
 *
 * @export
 * @class FileSystem
 * @typedef {FileSystem}
 * @extends {WebDAV.FileSystem}
 */
export class FileSystem extends WebDAV.FileSystem {
	public readonly sdk: SDK
	public readonly propertyManagers: Record<string, WebDAV.LocalPropertyManager> = {}
	public readonly lockManagers: Record<string, WebDAV.LocalLockManager> = {}
	public readonly virtualFiles: Record<string, FSStats> = {}
	private readonly __propertyManager: PropertyManager
	private readonly __lockManager: LockManager
	private readonly __type: Type
	private readonly __readDir: ReadDir
	private readonly __displayName: DisplayName
	private readonly __creationDate: CreationDate
	private readonly __lastModifiedDate: LastModifiedDate
	private readonly __size: Size
	private readonly __mimeType: MimeType
	private readonly __etag: ETag
	private readonly __fastExistsCheck: FastExistsCheck
	private readonly __copy: Copy
	private readonly __move: Move
	private readonly __rename: Rename
	private readonly __delete: Delete
	private readonly __create: Create
	private readonly __openWriteStream: OpenWriteStream
	private readonly __openReadStream: OpenReadStream
	public readonly tmpDir: string
	public readonly rwMutex: Record<string, ISemaphore> = {}
	public readonly mkdirMutex = new Semaphore(1)
	private readonly rootPath: string = ""

	/**
	 * Creates an instance of FileSystem.
	 *
	 * @constructor
	 * @public
	 * @param {{ sdk: SDK; tmpDir?: string; rootPath?: string }} param0
	 * @param {SDK} param0.sdk
	 * @param {string} param0.tmpDir
	 * @param {string} param0.rootPath
	 */
	public constructor({ sdk, tmpDir, rootPath }: { sdk: SDK; tmpDir?: string; rootPath?: string }) {
		super(new Serializer({ sdk }))

		this.tmpDir = tmpDir ? tmpDir : os.tmpdir()
		this.sdk = sdk
		this.rootPath = rootPath ? rootPath : ""
		this.__propertyManager = new PropertyManager({ fileSystem: this })
		this.__lockManager = new LockManager({ fileSystem: this })
		this.__type = new Type({ fileSystem: this })
		this.__readDir = new ReadDir({ fileSystem: this })
		this.__displayName = new DisplayName({ fileSystem: this })
		this.__creationDate = new CreationDate({ fileSystem: this })
		this.__lastModifiedDate = new LastModifiedDate({ fileSystem: this })
		this.__size = new Size({ fileSystem: this })
		this.__mimeType = new MimeType({ fileSystem: this })
		this.__etag = new ETag({ fileSystem: this })
		this.__fastExistsCheck = new FastExistsCheck({ fileSystem: this })
		this.__copy = new Copy({ fileSystem: this })
		this.__move = new Move({ fileSystem: this })
		this.__rename = new Rename({ fileSystem: this })
		this.__delete = new Delete({ fileSystem: this })
		this.__create = new Create({ fileSystem: this })
		this.__openWriteStream = new OpenWriteStream({ fileSystem: this })
		this.__openReadStream = new OpenReadStream({ fileSystem: this })
	}

	/**
	 * Construct a new path based on the configured root path of the WebDAV server.
	 *
	 * @private
	 * @param {WebDAV.Path} path
	 * @returns {WebDAV.Path}
	 */
	private _path(path: WebDAV.Path): WebDAV.Path {
		if (this.rootPath.length === 0 || !this.rootPath.includes("/") || !this.rootPath.startsWith("/")) {
			return path
		}

		return new WebDAV.Path(pathModule.posix.join(this.rootPath, path.toString()))
	}

	/**
	 * _propertyManager
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.PropertyManagerInfo} _ctx
	 * @param {WebDAV.ReturnCallback<WebDAV.IPropertyManager>} callback
	 */
	protected _propertyManager(
		path: WebDAV.Path,
		_ctx: WebDAV.PropertyManagerInfo,
		callback: WebDAV.ReturnCallback<WebDAV.IPropertyManager>
	): void {
		this.__propertyManager.run(this._path(path), callback)
	}

	/**
	 * _lockManager
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.LockManagerInfo} _ctx
	 * @param {WebDAV.ReturnCallback<WebDAV.ILockManager>} callback
	 */
	protected _lockManager(path: WebDAV.Path, _ctx: WebDAV.LockManagerInfo, callback: WebDAV.ReturnCallback<WebDAV.ILockManager>): void {
		this.__lockManager.run(this._path(path), callback)
	}

	/**
	 * _type
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.TypeInfo} _ctx
	 * @param {WebDAV.ReturnCallback<WebDAV.ResourceType>} callback
	 */
	protected _type(path: WebDAV.Path, _ctx: WebDAV.TypeInfo, callback: WebDAV.ReturnCallback<WebDAV.ResourceType>): void {
		this.__type.run(this._path(path), callback)
	}

	/**
	 * _readDir
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.ReadDirInfo} _ctx
	 * @param {WebDAV.ReturnCallback<string[] | WebDAV.Path[]>} callback
	 */
	protected _readDir(path: WebDAV.Path, _ctx: WebDAV.ReadDirInfo, callback: WebDAV.ReturnCallback<string[] | WebDAV.Path[]>): void {
		this.__readDir.run(this._path(path), callback)
	}

	/**
	 * _displayName
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.DisplayNameInfo} _ctx
	 * @param {WebDAV.ReturnCallback<string>} callback
	 */
	protected _displayName(path: WebDAV.Path, _ctx: WebDAV.DisplayNameInfo, callback: WebDAV.ReturnCallback<string>): void {
		this.__displayName.run(this._path(path), callback)
	}

	/**
	 * _creationDate
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.CreationDateInfo} _ctx
	 * @param {WebDAV.ReturnCallback<number>} callback
	 */
	protected _creationDate(path: WebDAV.Path, _ctx: WebDAV.CreationDateInfo, callback: WebDAV.ReturnCallback<number>): void {
		this.__creationDate.run(this._path(path), callback)
	}

	/**
	 * _lastModifiedDate
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.LastModifiedDateInfo} _ctx
	 * @param {WebDAV.ReturnCallback<number>} callback
	 */
	protected _lastModifiedDate(path: WebDAV.Path, _ctx: WebDAV.LastModifiedDateInfo, callback: WebDAV.ReturnCallback<number>): void {
		this.__lastModifiedDate.run(this._path(path), callback)
	}

	/**
	 * _size
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.SizeInfo} _ctx
	 * @param {WebDAV.ReturnCallback<number>} callback
	 */
	protected _size(path: WebDAV.Path, _ctx: WebDAV.SizeInfo, callback: WebDAV.ReturnCallback<number>): void {
		this.__size.run(this._path(path), callback)
	}

	/**
	 * _mimeType
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.MimeTypeInfo} _ctx
	 * @param {WebDAV.ReturnCallback<string>} callback
	 */
	protected _mimeType(path: WebDAV.Path, _ctx: WebDAV.MimeTypeInfo, callback: WebDAV.ReturnCallback<string>): void {
		this.__mimeType.run(this._path(path), callback)
	}

	/**
	 * _etag
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.ETagInfo} _ctx
	 * @param {WebDAV.ReturnCallback<string>} callback
	 */
	protected _etag(path: WebDAV.Path, _ctx: WebDAV.ETagInfo, callback: WebDAV.ReturnCallback<string>): void {
		this.__etag.run(this._path(path), callback)
	}

	/**
	 * _fastExistCheck
	 *
	 * @protected
	 * @param {WebDAV.RequestContext} _ctx
	 * @param {WebDAV.Path} path
	 * @param {(exists: boolean) => void} callback
	 */
	protected _fastExistCheck(_ctx: WebDAV.RequestContext, path: WebDAV.Path, callback: (exists: boolean) => void): void {
		this.__fastExistsCheck.run(this._path(path), callback)
	}

	/**
	 * _copy
	 *
	 * @protected
	 * @param {WebDAV.Path} pathFrom
	 * @param {WebDAV.Path} pathTo
	 * @param {WebDAV.CopyInfo} _ctx
	 * @param {WebDAV.ReturnCallback<boolean>} callback
	 */
	protected _copy(pathFrom: WebDAV.Path, pathTo: WebDAV.Path, _ctx: WebDAV.CopyInfo, callback: WebDAV.ReturnCallback<boolean>): void {
		this.__copy.run(this._path(pathFrom), this._path(pathTo), callback)
	}

	/**
	 * _move
	 *
	 * @protected
	 * @param {WebDAV.Path} pathFrom
	 * @param {WebDAV.Path} pathTo
	 * @param {WebDAV.MoveInfo} _ctx
	 * @param {WebDAV.ReturnCallback<boolean>} callback
	 */
	protected _move(pathFrom: WebDAV.Path, pathTo: WebDAV.Path, _ctx: WebDAV.MoveInfo, callback: WebDAV.ReturnCallback<boolean>): void {
		this.__move.run(this._path(pathFrom), this._path(pathTo), callback)
	}

	/**
	 * _rename
	 *
	 * @protected
	 * @param {WebDAV.Path} pathFrom
	 * @param {string} newName
	 * @param {WebDAV.RenameInfo} _ctx
	 * @param {WebDAV.ReturnCallback<boolean>} callback
	 */
	protected _rename(pathFrom: WebDAV.Path, newName: string, _ctx: WebDAV.RenameInfo, callback: WebDAV.ReturnCallback<boolean>): void {
		this.__rename.run(this._path(pathFrom), newName, callback)
	}

	/**
	 * _delete
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.DeleteInfo} _ctx
	 * @param {WebDAV.SimpleCallback} callback
	 */
	protected _delete(path: WebDAV.Path, _ctx: WebDAV.DeleteInfo, callback: WebDAV.SimpleCallback): void {
		this.__delete.run(this._path(path), callback)
	}

	/**
	 * _create
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.CreateInfo} ctx
	 * @param {WebDAV.SimpleCallback} callback
	 */
	protected _create(path: WebDAV.Path, ctx: WebDAV.CreateInfo, callback: WebDAV.SimpleCallback): void {
		this.__create.run(this._path(path), ctx, callback)
	}

	/**
	 * _openWriteStream
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.OpenWriteStreamInfo} _ctx
	 * @param {WebDAV.ReturnCallback<Writable>} callback
	 */
	protected _openWriteStream(path: WebDAV.Path, _ctx: WebDAV.OpenWriteStreamInfo, callback: WebDAV.ReturnCallback<Writable>): void {
		this.__openWriteStream.run(this._path(path), callback)
	}

	/**
	 * _openReadStream
	 *
	 * @protected
	 * @param {WebDAV.Path} path
	 * @param {WebDAV.OpenReadStreamInfo} _ctx
	 * @param {WebDAV.ReturnCallback<Readable>} callback
	 */
	protected _openReadStream(path: WebDAV.Path, _ctx: WebDAV.OpenReadStreamInfo, callback: WebDAV.ReturnCallback<Readable>): void {
		this.__openReadStream.run(this._path(path), callback)
	}
}

export default FileSystem
