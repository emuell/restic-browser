<img src="./src/assets/images/eye.png" alt="drawing" height="48px"/> <img src="./src/assets/images/logo.png" alt="drawing" height="48px"/> 

---

A simple, cross-platform [restic backup](https://github.com/restic/restic) GUI for browsing and restoring restic repositories. 

Built with [Tauri](https://tauri.app), based on leaanthony's [Restoric](https://github.com/leaanthony/restoric) PoC. 

Older versions of the restic browser were built using [Wails2](https://wails.io). The latest release based on Wails is [v0.2.6](https://github.com/emuell/restic-browser/releases/tag/v0.2.6). 

## Download

Prebuilt binaries can be downloaded from the [GitHub releases](https://github.com/emuell/restic-browser/releases) page.


## Features

This is not a fullblown restic backup GUI - it only allows you to *browse* existing repositories!

* *Displays* contents (snapshots, files) from local and remote restic repositories.
* *Dumps* selected files or folders (as a zip archive) to a desired location.
* *Restores* selected files or folders to a desired location.
* *Opens* selected files by moving them to TEMP, then opens them with your operating system's default programs.

![Screenshot](./screenshot.png "Restic Browser")


## Keyboard Navigation

The UI is navigatable via keyboard shortcuts. To change the focus area, hit `Tab` + `Shift-Tab` keys.

### Global Shortcuts: 

- `Control/CMD + O`: Open new repository

### Snapshot-List
- `Arrow keys`, `Page Up/Down`, `Home/End`: Change selected snapshot

### File-List
- `Arrow keys`, `Page Up/Down`, `Home/End`: Change selected file
- `o` or `Enter` or `Space`: Open selected file or folder
- `d`: Dump selected file or folder as zip file
- `r`: Restore selected file or folder


## System Requirements

#### All platforms
- Install [restic](https://github.com/restic/restic/releases/) and *make sure it is included in your $PATH*.<br />
  On MacOS, where setting the PATH for desktop applications is a really hard thing to do, the restic executable will also be found if it's in one of the following folders: `/usr/local/bin, /opt/local/bin, /opt/homebrew/bin, ~/bin`.

#### Windows:
- Windows 10 or later with [WebView2 Runtime](https://developer.microsoft.com/de-de/microsoft-edge/webview2/#download-section)
#### MacOS:
- macOS 10.13 or later
#### Linux:
- Linux with GLIBC_2.31 or later (e.g. Ubuntu 20.04 or later)
- WebKit2 (install via `apt install libwebkit2gtk-4.0` on Ubuntu)


## Development

### Dependencies

* Follow the [Tauri Prerequisites Docs](https://tauri.app/v1/guides/getting-started/prerequisites/) to install a *C/C++ toolchain* and *Rust* for your platform.
* Make sure [npm](https://nodejs.org/en/download) *Node v18 LTS* is installed.
* Install [restic](https://github.com/restic/restic/releases/) and make sure it is included in your $PATH. 
  
Note: installing the tauri CLI via cargo is not necessary. Tauri can be lunched through npm (see below). 

### Front-end and App Development

To work in live development mode with automatic hot-reloading, run `npm run tauri dev` in the root directory. 

### Rust Backend Debugging

To debug the Tauri Rust application code, you can use the included startup tasks of vscode. If you press "F5" in vscode, the application will be built in debug mode and then started.   

### Building Production Packages

To build a redistributable package in production mode, run `npm run tauri build` in the root directory.


## License

MIT license. See [LICENSE](./LICENSE) for the full text.


## Contribute

Patches are welcome! Please fork the latest git repository and create a feature branch. 
