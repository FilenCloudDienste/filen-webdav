import { type PassThrough } from "stream"

declare global {
	namespace Express {
		interface Request {
			username?: string
			bodyStream?: PassThrough
			bodySize?: number
		}
	}
}
