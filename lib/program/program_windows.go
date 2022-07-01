//go:build windows

package program

import (
	"bytes"
	"os/exec"
	"syscall"
)

// Run impl for Windows
func (p *Program) Run(vars ...string) (stdout, stderr string, exitCode int, err error) {

	// SysProcAttr is necessary for Windows to properly hide the cmd window:
	// https://newbedev.com/how-to-hide-command-prompt-window-when-using-exec-in-golang
	cmd := exec.Command(p.Path, vars...)
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
			exitCode = ws.ExitStatus()
		} else {
			exitCode = 1
			if stderr == "" {
				stderr = err.Error()
			}
		}
	} else {
		// success, exitCode should be 0 if go is ok
		ws := cmd.ProcessState.Sys().(syscall.WaitStatus)
		exitCode = ws.ExitStatus()
	}
	return stdout, stderr, exitCode, err
}
