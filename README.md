<br/>
<p align="center">
  <h3 align="center">Filen WebDAV</h3>

  <p align="center">
    A package to start a WebDAV server for a Filen account.
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

2. Initialize the server

```typescript
const hostname = "127.0.0.1"
const port = 1901
const server = new WebDAVServer({
	users: [
		{
			name: "admin",
			password: "admin",
			isAdmin: true,
			rights: ["all"]
		}
	],
	hostname,
	port,
	sdkConfig: /* @filen/sdk config */
})

server
	.initialize()
	.then(() => console.log(`WebDAV server started on http://${hostname}:${port}`))
	.catch(console.error)
```

3. Access the server

```sh
// MacOS
mount_webdav -S -v 'Filen' http://${hostname}:${port} /mnt/filen
```

## License

Distributed under the AGPL-3.0 License. See [LICENSE](https://github.com/FilenCloudDienste/filen-webdav/blob/main/LICENSE.md) for more information.
