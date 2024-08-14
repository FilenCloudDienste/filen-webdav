import selfsigned from "selfsigned"
import fs from "fs-extra"
import pathModule from "path"
import { platformConfigPath } from "./utils"
import writeFileAtomic from "write-file-atomic"

/**
 * Certs
 *
 * @export
 * @class Certs
 * @typedef {Certs}
 */
export class Certs {
	public static dirPath = platformConfigPath()
	public static certPath = pathModule.join(this.dirPath, "cert")
	public static privateKeyPath = pathModule.join(this.dirPath, "privateKey")
	public static expiryPath = pathModule.join(this.dirPath, "expiry")

	/**
	 * Get or generate the self signed SSL certificate.
	 *
	 * @public
	 * @static
	 * @async
	 * @returns {Promise<{ cert: Buffer; privateKey: Buffer }>}
	 */
	public static async get(): Promise<{ cert: Buffer; privateKey: Buffer }> {
		await fs.ensureDir(this.dirPath)

		const now = Date.now()
		const [certExists, privateKeyExists, expiryExists] = await Promise.all([
			fs.exists(this.certPath),
			fs.exists(this.privateKeyPath),
			fs.exists(this.expiryPath)
		])

		if (certExists && privateKeyExists && expiryExists) {
			const expires = parseInt(await fs.readFile(this.expiryPath, "utf8"))

			if (now > expires) {
				return {
					cert: await fs.readFile(this.certPath),
					privateKey: await fs.readFile(this.privateKeyPath)
				}
			}
		}

		const generated = selfsigned.generate(
			[
				{
					name: "commonName",
					value: "local.webdav.filen.io"
				}
			],
			{
				days: 365,
				algorithm: "sha256",
				keySize: 2048
			}
		)

		await Promise.all([
			writeFileAtomic(this.certPath, generated.cert, "utf-8"),
			writeFileAtomic(this.privateKeyPath, generated.private, "utf-8"),
			writeFileAtomic(this.expiryPath, (now + 86400 * 360).toString(), "utf-8")
		])

		return {
			cert: Buffer.from(generated.cert, "utf-8"),
			privateKey: Buffer.from(generated.private, "utf-8")
		}
	}
}

export default Certs
