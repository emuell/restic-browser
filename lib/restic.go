package lib

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/emuell/restic-browser/lib/program"
)

// Restic holds information about the Restic Binary
type Restic struct {
	VersionString string
	Version       string
	restic        *program.Program
}

// Run restic program and return stdout and err, exitCode and error.
func (r *Restic) Run(command []string) (stdout, stderr string, code int, err error) {
	return r.restic.Run(command...)
}

// Run restic program and write stdout to the given file. returns stdErr, exitCode and error.
func (r *Restic) RunRedirected(stdOutFile *os.File, command []string) (stdErr string, code int, err error) {
	return r.restic.RunRedirected(stdOutFile, command...)
}

// NewRepo creates a new repo instance
func (r *Restic) NewRepo(location Location, password string) (*Repository, error) {
	return NewRepository(location, password, r), nil
}

// NewRestic creates a new Restic struct
func NewRestic() (restic *Restic, err error) {

	// Find restic executable
	var programName = "restic"
	if runtime.GOOS == "windows" {
		programName += ".exe"
	}
	resticProgram := program.Find(programName, "Restic")
	if resticProgram == nil {
		return nil, fmt.Errorf("unable to find '%s'", programName)
	}

	// Get the version
	versionstring, _, code, _ := resticProgram.Run("version")
	if code != 0 {
		return nil, fmt.Errorf("failed to fetch restic version from %s", resticProgram.Path)
	}

	// Get restic version
	version := "unknown"
	splitVersion := strings.Split(versionstring, " ")
	if len(splitVersion) > 2 {
		version = splitVersion[1]
	}

	restic = &Restic{
		VersionString: versionstring,
		Version:       version,
		restic:        resticProgram,
	}

	return restic, nil
}
