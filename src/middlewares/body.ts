import { type Request, type Response, type NextFunction } from "express"
import crypto from "crypto"
import { PassThrough } from "stream"

export default function body(req: Request, _: Response, next: NextFunction): void {
	const hash = crypto.createHash("sha256")
	const passThrough = new PassThrough()
	let size = 0

	req.bodyStream = passThrough

	req.on("data", chunk => {
		if (chunk instanceof Buffer) {
			size += chunk.byteLength

			hash.update(chunk)

			passThrough.write(chunk)
		}
	})

	req.on("end", () => {
		req.bodyHash = hash.digest("hex")
		req.bodySize = size

		passThrough.end()

		next()
	})

	req.on("error", err => {
		passThrough.emit("error", err)

		next(err)
	})
}
