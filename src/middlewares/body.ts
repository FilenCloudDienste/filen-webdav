import { type Request, type Response, type NextFunction } from "express"
import Responses from "../responses"

export default function body(req: Request, res: Response, next: NextFunction): void {
	if (!["POST", "PUT"].includes(req.method)) {
		next()

		return
	}

	req.once("readable", () => {
		try {
			const chunk = req.read(1)

			req.firstBodyChunk = chunk instanceof Buffer ? chunk : null

			next()
		} catch {
			Responses.internalError(res).catch(() => {})
		}
	})
}
