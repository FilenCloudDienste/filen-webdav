import { memoize } from "lodash"
import crypto from "crypto"

export const pathToHash = memoize((path: string): string => {
	return crypto.createHash("sha256").update(path).digest("hex")
})
