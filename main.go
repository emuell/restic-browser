package main

import (
	"os"
	"fmt"
	"runtime"
  "github.com/leaanthony/restoric/lib"
  "github.com/leaanthony/sail/program"
  "github.com/leaanthony/mewn"
  "github.com/wailsapp/wails"
)

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

  js := mewn.String("./frontend/dist/app.js")
  css := mewn.String("./frontend/dist/app.css")

  app := wails.CreateApp(&wails.AppConfig{
    Width:  1024,
    Height: 768,
    Title:  "Restoric",
    JS:     js,
    CSS:    css,
    Colour: "#131313",
  })
  app.Bind(lib.NewRestoric(restic))
  app.Run()
}
