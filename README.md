<br/>
<p align="center">
  <h3 align="center">Filen WebDAV</h3>

  <p align="center">
    A package to start a WebDAV server for a single or multiple Filen accounts.
    <br/>
    <br/>
  </p>
</p>

![Contributors](https://img.shields.io/github/contributors/FilenCloudDienste/filen-webdav?color=dark-green) ![Forks](https://img.shields.io/github/forks/FilenCloudDienste/filen-webdav?style=social) ![Stargazers](https://img.shields.io/github/stars/FilenCloudDienste/filen-webdav?style=social) ![Issues](https://img.shields.io/github/issues/FilenCloudDienste/filen-webdav) ![License](https://img.shields.io/github/license/FilenCloudDienste/filen-webdav)

### Installation

1. Install using NPM

```sh
npm install @filen/webdav@latest
```

2. Initialize the server (standalone mode, single user)

```typescript
// Standalone mode, single user

import FilenSDK from "@filen/sdk"
import path from "path"
import os from "os"
import WebDAVServer from "@filen/webdav"

// Initialize a SDK instance (optional)
const filen = new FilenSDK({
	metadataCache: true,
	connectToSocket: true,
	tmpPath: path.join(os.tmpdir(), "filen-sdk")
})

await filen.login({
	email: "your@email.com",
	password: "supersecret123",
	twoFactorCode: "123456"
})

const hostname = "127.0.0.1"
const port = 1900
const https = false
const server = new WebDAVServer({
	hostname,
	port,
	https,
	user: {
		username: "admin",
		password: "admin",
		sdk: filen
	},
	authMode: "basic" | "digest"
})

await server.start()

console.log(
	`WebDAV server started on ${https ? "https" : "http"}://${hostname === "127.0.0.1" ? "local.webdav.filen.io" : hostname}:${port}`
)
```

3. Initialize the server (proxy mode)

<small>When in proxy mode, the server acts as a local WebDAV gateway for multiple Filen accounts. It accepts Filen login credentials formatted as follows (without the double backticks):</small>

```
Username: "youremail@example.com"
Password: "password=yoursecretpassword&twoFactorAuthentication=<RECOVERY_CODE_OR_6_DIGIT_OTP_CODE>"

// You can also leave out the "&twoFactorAuthentication=" part if your account is not protected by 2FA.
```

<small>Useful for everyone who wants to host a single WebDAV server for multiple accounts/users. Everything still runs client side, keeping the zero-knowledge end-to-end encryption intact.</small>

```typescript
// Proxy mode, multi user

import WebDAVServer from "@filen/webdav"

const hostname = "127.0.0.1"
const port = 1900
const https = false
const server = new WebDAVServer({
	hostname,
	port,
	https,
	// Omit the user object
	authMode: "basic" // Only basic auth is supported in proxy mode
})

await server.start()

console.log(
	`WebDAV server started on ${https ? "https" : "http"}://${hostname === "127.0.0.1" ? "local.webdav.filen.io" : hostname}:${port}`
)
```

4. Initialize the server (cluster mode)

```typescript
import FilenSDK from "@filen/sdk"
import path from "path"
import os from "os"
import { WebDAVServerCluster } from "@filen/webdav"

// Initialize a SDK instance (optional)
const filen = new FilenSDK({
	metadataCache: true,
	connectToSocket: true,
	tmpPath: path.join(os.tmpdir(), "filen-sdk")
})

await filen.login({
	email: "your@email.com",
	password: "supersecret123",
	twoFactorCode: "123456"
})

const hostname = "127.0.0.1"
const port = 1900
const https = false
const server = new WebDAVServerCluster({
	hostname,
	port,
	https,
	user: {
		username: "admin",
		password: "admin",
		sdk: filen
	},
	authMode: "basic" | "digest",
	threads: 16 // Number of threads to spawn. Defaults to CPU core count if omitted.
})

await server.start()

console.log(
	`WebDAV server cluster started on ${https ? "https" : "http"}://${
		hostname === "127.0.0.1" ? "local.webdav.filen.io" : hostname
	}:${port}`
)
```

5. Access the server

```sh
// MacOS
mount_webdav -S -v 'Filen' http://${hostname}:${port} /mnt/filen
```

## License

Distributed under the AGPL-3.0 License. See [LICENSE](https://github.com/FilenCloudDienste/filen-webdav/blob/main/LICENSE.md) for more information.
