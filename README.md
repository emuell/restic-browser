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


## Arguments

### Usage
```
Restic-Browser [OPTIONS]
```

### Options
```
-h, --help
    Print help information

--insecure-tls
    skip TLS certificate verification when connecting to the repo (insecure)

--password <password>
    password for the repository - NOT RECOMMENDED - USE password-file/command instead. (default: $RESTIC_PASSWORD)

--password-command <password-command>
    shell command to obtain the repository password from (default: $RESTIC_PASSWORD_COMMAND)
  
--password-file <password-file>
    file to read the repository password from (default: $RESTIC_PASSWORD_FILE)

-r, --repo <repo>
    repository to show or restore from (default: $RESTIC_REPOSITORY)

--rclone <rclone>
    ABS path to the rclone executable that should be used for rclone locations. (default: 'rclone')

--repository-file <repository-file>
    file to read the repository location from (default: $RESTIC_REPOSITORY_FILE)

--restic <restic>
    ABS path to the restic executable that should be used. (default: find in $PATH)

-V, --version
    Print version information
```

## System Requirements

#### All platforms
- Install [restic](https://github.com/restic/restic/releases/) and *make sure it is included in your $PATH*.<br />
  On MacOS, where setting the PATH for desktop applications is a really hard thing to do, the restic executable will also be found if it's in one of the following folders: `/usr/local/bin, /opt/local/bin, /opt/homebrew/bin, ~/bin`.

#### Windows:
- Windows 10 or later with [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/#download-section)

#### MacOS:
- macOS 10.13 or later

#### Linux:
- Linux with GLIBC_2.31 or later (e.g. Ubuntu 20.04 or later)
- WebKit2 (install via `apt install libwebkit2gtk-4.0` on Ubuntu)
- Try using the Linux appimage from the prebuilt releases, in case libwebkit2gtk-4.0 is not available on your system.

## Development

### Dependencies

* Follow the [Tauri Prerequisites Docs](https://tauri.app/v1/guides/getting-started/prerequisites/) to install a *C/C++ toolchain* and *Rust* 1.78 or later for your platform.
* Make sure [npm](https://nodejs.org/en/download) *Node* 18 LTS or later is installed.
* Install [restic](https://github.com/restic/restic/releases/) and make sure it is included in your $PATH. 
  
Note: installing the tauri CLI via cargo is not necessary. Tauri can be launched through npm (see below). 

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
