import { type Request, type Response, type NextFunction } from "express"
import { PassThrough } from "stream"

export default function body(req: Request, _: Response, next: NextFunction): void {
	const passThrough = new PassThrough()
	let size = 0

	req.bodyStream = passThrough

	req.on("data", chunk => {
		if (chunk instanceof Buffer) {
			size += chunk.byteLength

			passThrough.write(chunk)
		}
	})

	req.on("end", () => {
		req.bodySize = size

		passThrough.end()

		next()
	})

	req.on("error", err => {
		passThrough.emit("error", err)
	})
}
