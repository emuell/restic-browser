package program

import (
	"os/exec"
	"path/filepath"
	"syscall"
)

// Program holds information about a program
type Program struct {
	Name     string
	Filename string
	Path     string
}

// Find will try and find the given filename on the path
func Find(filename string, name string) *Program {
	path, err := exec.LookPath(filename)
	if err != nil {
		return nil
	}
	path, err = filepath.Abs(path)
	if err != nil {
		return nil
	}
	return &Program{
		Name:     name,
		Filename: filename,
		Path:     path,
	}
}

// Get exit code for a cmd which already ran
// see https://stackoverflow.com/questions/10385551/get-exit-code-go
func getCmdExitCode(cmd *exec.Cmd, err error) int {
	if err != nil {
		// try to get the exit code from err
		if exitError, ok := err.(*exec.ExitError); ok {
			ws := exitError.Sys().(syscall.WaitStatus)
			return ws.ExitStatus()
		} else {
			return 1
		}
	} else {
		// success, exitCode should be 0 if go is ok
		ws := cmd.ProcessState.Sys().(syscall.WaitStatus)
		return ws.ExitStatus()
	}
}
