package open

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestOpenFile(t *testing.T) {
	// test abs file path
	_, absFilePath, _, ok := runtime.Caller(1)
	if !ok {
		t.Fatal("failed to get current filename")
	}
	err := OpenFileOrURL(absFilePath)
	if err != nil {
		// NB: skip instead of failing as this will fail when running headless
		t.Skip("failed to open abs file path", err)
	}
	// test relative file path
	directory := filepath.Dir(absFilePath)
	filename := filepath.Base(absFilePath)
	err = os.Chdir(directory)
	if err != nil {
		t.Error(err)
	}
	err = OpenFileOrURL(filename)
	if err != nil {
		// NB: skip instead of failing as this will fail when running headless
		t.Skip("failed to open relative file path", err)
	}
}

func TestOpenURL(t *testing.T) {
	// test url
	const url = "https://github.com/emuell/restic-browser"
	err := OpenFileOrURL(url)
	if err != nil {
		// NB: skip instead of failing as this will fail when running headless
		t.Skip("failed to open URL", err)
	}
}
