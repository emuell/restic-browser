<img src="./frontend/src/assets/images/eye.png" alt="drawing" height="48px"/> <img src="./frontend/src/assets/images/logo.png" alt="drawing" height="48px"/> 

---

A simple, cross-platform [restic backup](https://github.com/restic/restic) GUI for browsing and restoring restic repositories. 

Built with [Wails2](https://wails.io), based on leaanthony's [Restoric](https://github.com/leaanthony/restoric) PoC. 


## Download

Prebuilt binaries can be downloaded from the [GitHub releases](https://github.com/emuell/restic-browser/releases) page.


## Features

* *Displays* contents (snapshots, files) from local and remote restic repositories.
* *Restores* selected files or folders (as a zip archive) to a desired location.
* *Opens* selected files by moving them to TEMP, then opens them with your operating system's default programs.

This is not a fullblown restic backup GUI - it only allows you to *browse* existing repositories!  

![Screenshot](./screenshot.png "Restic Browser")


## System Requirements

#### All platforms
- Install [restic](https://github.com/restic/restic/releases/) and *make sure it is included in your $PATH*. 

#### Windows:
- Windows 10 or later with WebView2 Runtime
#### MacOS:
- macOS 10.14 or later
#### Linux:
- Linux with GLIBC_2.34 (e.g. Ubuntu 22)
- WebKit2 (libwebkit2gtk-4.0)


## Development

### Dependencies

* Follow the [Wails2 Installation Docs](https://wails.io/docs/gettingstarted/installation) to install Wails2 for your platform.
* Install [restic](https://github.com/restic/restic/releases/) and *make sure it is included in your $PATH*. 

### Front-end and App Development

To work in live development mode with automatic hot-reloading, run `wails dev` in the root directory. 

### Go Backend Debugging

To debug the Wails Go application code, you can use the included startup tasks of vscode. If you press "F5" in vscode, the application will be built in debug mode and then started.   

### Building Production Packages

To build a redistributable package in production mode, use `wails build -tags production,desktop` or use the default build task in vscode.


## License

MIT license. See [LICENSE](./LICENSE) for the full text.


## Contribute

Patches are welcome! Please fork the latest git repository and create a feature branch. 
