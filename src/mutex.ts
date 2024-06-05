import { Semaphore, ISemaphore } from "./semaphore"
import { removeLastSlash } from "./utils"

/**
 * Mutex
 *
 * @export
 * @class Mutex
 * @typedef {Mutex}
 */
export class Mutex {
	public static readonly mutex: { rw: Record<string, ISemaphore> } = {
		rw: {}
	}

	public static get(path: string, type: "rw"): ISemaphore {
		if (type === "rw") {
			if (!this.mutex.rw[path]) {
				this.mutex.rw[path] = new Semaphore(1)
			}

			return this.mutex.rw[path]!
		} else {
			if (!this.mutex.rw[path]) {
				this.mutex.rw[path] = new Semaphore(1)
			}

			return this.mutex.rw[path]!
		}
	}

	public static delete(path: string, type: "rw"): void {
		if (type === "rw") {
			delete this.mutex.rw[path]
		} else {
			delete this.mutex.rw[path]
		}
	}

	public static async acquireReadWrite(path: string): Promise<void> {
		path = removeLastSlash(decodeURI(path))

		await this.get(path, "rw").acquire()
	}

	public static async releaseReadWrite(path: string): Promise<void> {
		path = removeLastSlash(decodeURI(path))

		this.get(path, "rw").release()
	}
}

export default Mutex
