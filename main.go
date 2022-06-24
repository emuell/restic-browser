package main

import (
	"embed"
	"fmt"
	"os"
	"runtime"

	"github.com/emuell/restoric/lib"
	"github.com/leaanthony/sail/program"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

//go:embed frontend/dist
var assets embed.FS

func abort(format string, args ...interface{}) {
	fmt.Printf(format+"\n", args...)
	os.Exit(1)
}

func main() {
	var programName = "restic"
	if runtime.GOOS == "windows" {
		programName += ".exe"
	}
	resticBin := program.Find(programName, "Restic")
	if resticBin == nil {
		abort("Enable to find '%s'. Please make sure it is on your PATH.", programName)
	}
	restic, err := lib.NewRestic(resticBin)
	if err != nil {
		abort(err.Error())
	}

	// Create an instance of the app structure
	app := lib.NewRestoric(restic)

	// Create application with options
	err = wails.Run(&options.App{
		Title:     "restoric",
		Width:     1024,
		Height:    768,
		Assets:    assets,
		OnStartup: app.Startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err)
	}
}
