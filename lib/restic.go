package lib

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/leaanthony/sail/program"
)

// Restic holds information about the Restic Binary
type Restic struct {
	VersionString string
	Version       string

	restic *program.Program
}

func (r *Restic) Run(command []string) (stdout, stderr string, code int, err error) {

	// NB: do not use r.restic.Run(command...) here. SysProcAttr is necessary for Windows
	// to hide the cmd window:
	// https://newbedev.com/how-to-hide-command-prompt-window-when-using-exec-in-golang
	cmd := exec.Command(r.restic.Path, command...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	var stdo, stde bytes.Buffer
	cmd.Stdout = &stdo
	cmd.Stderr = &stde
	err = cmd.Run()
	stdout = string(stdo.Bytes())
	stderr = string(stde.Bytes())
	// https://stackoverflow.com/questions/10385551/get-exit-code-go
	if err != nil {
		// try to get the exit code
		if exitError, ok := err.(*exec.ExitError); ok {
			ws := exitError.Sys().(syscall.WaitStatus)
			code = ws.ExitStatus()
		} else {
			code = 1
			if stderr == "" {
				stderr = err.Error()
			}
		}
	} else {
		// success, exitCode should be 0 if go is ok
		ws := cmd.ProcessState.Sys().(syscall.WaitStatus)
		code = ws.ExitStatus()
	}
	return stdout, stderr, code, err
}

// NewRepo creates a new repo instance
func (r *Restic) NewRepo(path string, password string) (*Repository, error) {
	path, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	return NewRepository(path, password, r), nil
}

// NewRestic creates a new Restic struct
func NewRestic(restic *program.Program) (*Restic, error) {

	// Get the version
	versionstring, _, code, _ := restic.Run("version")
	if code != 0 {
		return nil, fmt.Errorf("failed to fetch restic version from %s", restic.Path)
	}

	// Find restic version
	version := "unknown"
	splitVersion := strings.Split(versionstring, " ")
	if len(splitVersion) > 2 {
		version = splitVersion[1]
	}

	result := &Restic{
		VersionString: versionstring,
		Version:       version,
		restic:        restic,
	}

	return result, nil
}
