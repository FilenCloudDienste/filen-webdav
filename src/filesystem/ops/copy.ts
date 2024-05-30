import * as WebDAV from "@filen/webdav-server"
import type FileSystem from ".."
import { Semaphore } from "../../semaphore"

export class Copy {
	private readonly fileSystem: FileSystem

	public constructor({ fileSystem }: { fileSystem: FileSystem }) {
		this.fileSystem = fileSystem
	}

	private async execute(pathFrom: WebDAV.Path, pathTo: WebDAV.Path): Promise<boolean> {
		if (!this.fileSystem.rwMutex[pathFrom.toString()]) {
			this.fileSystem.rwMutex[pathFrom.toString()] = new Semaphore(1)
		}

		if (!this.fileSystem.rwMutex[pathTo.toString()]) {
			this.fileSystem.rwMutex[pathTo.toString()] = new Semaphore(1)
		}

		await Promise.all([this.fileSystem.rwMutex[pathFrom.toString()]!.acquire(), this.fileSystem.rwMutex[pathTo.toString()]!.acquire()])

		try {
			if (this.fileSystem.virtualFiles[pathFrom.toString()]) {
				throw WebDAV.Errors.InvalidOperation
			}

			try {
				await this.fileSystem.sdk.fs().cp({ from: pathFrom.toString(), to: pathTo.toString() })

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
			this.fileSystem.rwMutex[pathTo.toString()]!.release()
		}
	}

	public run(pathFrom: WebDAV.Path, pathTo: WebDAV.Path, callback: WebDAV.ReturnCallback<boolean>): void {
		this.execute(pathFrom, pathTo)
			.then(result => {
				callback(undefined, result)
			})
			.catch(err => {
				callback(err)
			})
	}
}

export default Copy
