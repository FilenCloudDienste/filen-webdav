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

# Attention

The package is still a work in progress. DO NOT USE IT IN PRODUCTION YET. Class names, function names, types, definitions, constants etc. are subject to change until we release a fully tested and stable version.

### Installation

1. Install using NPM

```sh
npm install @filen/webdav@latest
```

2. Initialize the server (standalone mode, single user)

```typescript
// Standalone mode, single user

import WebDAVServer from "@filen/webdav"

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
		sdkConfig
	},
	authMode: "basic" | "digest"
})

server
	.start()
	.then(() =>
		console.log(
			`WebDAV server started on ${https ? "https" : "http"}://${
				hostname === "127.0.0.1" ? "local.webdav.filen.io" : hostname
			}:${port}`
		)
	)
	.catch(console.error)
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

server
	.start()
	.then(() =>
		console.log(
			`WebDAV server started on ${https ? "https" : "http"}://${
				hostname === "127.0.0.1" ? "local.webdav.filen.io" : hostname
			}:${port}`
		)
	)
	.catch(console.error)
```

4. Access the server

```sh
// MacOS
mount_webdav -S -v 'Filen' http://${hostname}:${port} /mnt/filen
```

## License

Distributed under the AGPL-3.0 License. See [LICENSE](https://github.com/FilenCloudDienste/filen-webdav/blob/main/LICENSE.md) for more information.
