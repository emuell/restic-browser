//go:build !windows

package program

import (
	"bytes"
	"os"
	"os/exec"
)

// Default Run impl
func (p *Program) Run(vars ...string) (stdout, stderr string, exitCode int, err error) {

	var stdOutBuffer, stdErrBuffer bytes.Buffer
	cmd := exec.Command(p.Path, vars...)
	cmd.Stdout = &stdOutBuffer
	cmd.Stderr = &stdErrBuffer

	err = cmd.Run()
	stdout = stdOutBuffer.String()
	stderr = stdErrBuffer.String()
	exitCode = getCmdExitCode(cmd, err)
	if exitCode == 1 && stderr == "" {
		stderr = err.Error()
	}
	return
}

// Default RunRedirected impl
func (p *Program) RunRedirected(stdout *os.File, vars ...string) (stderr string, exitCode int, err error) {

	var stderrBuffer bytes.Buffer
	cmd := exec.Command(p.Path, vars...)
	cmd.Stdout = stdout
	cmd.Stderr = &stderrBuffer

	err = cmd.Run()
	stderr = stderrBuffer.String()
	exitCode = getCmdExitCode(cmd, err)
	if exitCode == 1 && stderr == "" {
		stderr = err.Error()
	}
	err = stdout.Sync()
	if err != nil && stderr == "" {
		stderr = err.Error()
	}
	return
}
