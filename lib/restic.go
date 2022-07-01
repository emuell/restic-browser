package lib

import (
	"fmt"
	"path/filepath"
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

func (r *Restic) Run(command []string) (stdout, stderr string, code int, err error) {

	return r.restic.Run(command...)
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
func NewRestic() (*Restic, error) {

	// Find restic executable
	var programName = "restic"
	if runtime.GOOS == "windows" {
		programName += ".exe"
	}
	restic := program.Find(programName, "Restic")
	if restic == nil {
		return nil, fmt.Errorf("unable to find '%s'", programName)
	}

	// Get the version
	versionstring, _, code, _ := restic.Run("version")
	if code != 0 {
		return nil, fmt.Errorf("failed to fetch restic version from %s", restic.Path)
	}

	// Get restic version
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
