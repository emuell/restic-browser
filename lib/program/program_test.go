package program

import (
	"os"
	"testing"
)

func TestProgram(t *testing.T) {
	// find go program
	program := Find("go", "Go")
	if program == nil {
		t.Error("failed to find go program")
	}
	// test successful program run
	stdOut, stdErr, exitCode, err := program.Run("version")
	if stdOut == "" || stdErr != "" || exitCode != 0 || err != nil {
		t.Error("failed to run go program")
	}
	// test failed program run
	stdOut, stdErr, exitCode, err = program.Run("!!invalid_arg!!")
	if stdOut != "" || stdErr == "" || exitCode == 0 || err == nil {
		t.Error("unexpected run result")
	}
	// test successful redirected run
	tempFile, err := os.CreateTemp(t.TempDir(), "program")
	if tempFile == nil || err != nil {
		t.Error("failed to create a temp file", err)
	}
	defer tempFile.Close()
	stdErr, exitCode, err = program.RunRedirected(tempFile, "help")
	if stdErr != "" || exitCode != 0 || err != nil {
		t.Error("unexpected runRedirected result")
	}
	fileInfo, err := tempFile.Stat()
	if fileInfo == nil || err != nil || fileInfo.Size() == 0 {
		t.Error("unexpected runRedirected file result")
	}
}
