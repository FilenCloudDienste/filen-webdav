import * as WebDAV from "@filen/webdav-server"
import type FileSystem from ".."
import pathModule from "path"
import { Semaphore } from "../../semaphore"

export class Rename {
	private readonly fileSystem: FileSystem

	public constructor({ fileSystem }: { fileSystem: FileSystem }) {
		this.fileSystem = fileSystem
	}

	private async execute(pathFrom: WebDAV.Path, newName: string): Promise<boolean> {
		if (!this.fileSystem.rwMutex[pathFrom.toString()]) {
			this.fileSystem.rwMutex[pathFrom.toString()] = new Semaphore(1)
		}

		const newPath = pathModule.posix.join(pathFrom.toString(), "..", newName)

		if (!this.fileSystem.rwMutex[newPath]) {
			this.fileSystem.rwMutex[newPath] = new Semaphore(1)
		}

		await Promise.all([this.fileSystem.rwMutex[pathFrom.toString()]!.acquire(), this.fileSystem.rwMutex[newPath]!.acquire()])

		try {
			if (this.fileSystem.virtualFiles[pathFrom.toString()]) {
				this.fileSystem.virtualFiles[pathFrom.toString()]!.name = newName

				return true
			}

			try {
				await this.fileSystem.sdk.fs().rename({ from: pathFrom.toString(), to: newPath })

				return true
			} catch (e) {
				console.error(e) // TODO: Proper debugger

				const err = e as unknown as { code?: string }

				if (err.code === "ENOENT") {
					throw WebDAV.Errors.PropertyNotFound
				}

				throw WebDAV.Errors.InvalidOperation
			}
		} finally {
			this.fileSystem.rwMutex[pathFrom.toString()]!.release()
			this.fileSystem.rwMutex[newPath]!.release()
		}
	}

	public run(pathFrom: WebDAV.Path, newName: string, callback: WebDAV.ReturnCallback<boolean>): void {
		this.execute(pathFrom, newName)
			.then(result => {
				callback(undefined, result)
			})
			.catch(err => {
				callback(err)
			})
	}
}

export default Rename
