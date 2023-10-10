package main

import (
	"embed"
	"flag"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	// parse command line args
	resticPath := flag.String("restic", "", "Optional path to the restic binary");
	flag.Parse()
	
	// Create an instance of the restic app
	app := NewResticBrowser(resticPath)

	// Create wails application with options and bind the app to the frontend
	err := wails.Run(&options.App{
		Title:            "Restic Browser",
		Width:            1024,
		Height:           768,
		WindowStartState: options.Normal,
		Assets:           assets,
		BackgroundColour: &options.RGBA{R: 38, G: 41, B: 44, A: 255},
		OnStartup:        app.Startup,
		OnDomReady:       app.DomReady,
		OnShutdown:       app.Shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err)
	}
}
