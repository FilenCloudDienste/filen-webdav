declare global {
	namespace Express {
		interface Request {
			username?: string
			firstBodyChunk?: Buffer | null
		}
	}
}

export {}
