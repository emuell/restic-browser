# Restoric

A PoC [Restic](https://github.com/restic/restic) User Interface using the [Wails](https://wails.app) framework.

## Development

* During development, the repository to test against is hard coded in `lib/restoric.go`.
* You need restic installed
* Only tested on OSX/Chrome/Restoric 0.9.4

## Notes

 * I'm unsure whether this will ever work properly without restic being a library. Mainly because we need to construct cli commands and shell out to use the restic binary. There's usually a shell limit to how long a line can be so whether this may never be practical.
