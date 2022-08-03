package restic

import (
	"fmt"
	"os"
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

// Run restic program and return stdout and err, exitCode and error.
func (r *Restic) Run(command []string) (stdout, stderr string, code int, err error) {
	return r.restic.Run(command...)
}

// Run restic program and write stdout to the given file. returns stdErr, exitCode and error.
func (r *Restic) RunRedirected(stdOutFile *os.File, command []string) (stdErr string, code int, err error) {
	return r.restic.RunRedirected(stdOutFile, command...)
}

// NewRepo creates a new repo instance
func (r *Restic) NewRepo(location Location) (*Repository, error) {
	return NewRepository(location, r), nil
}

// ResticProgramName returns the expected platform dependend restic program name
func ResticProgramName() string {
	programName := "restic"
	if runtime.GOOS == "windows" {
		programName += ".exe"
	}
	return programName
}

// NewRestic creates a new Restic struct
func NewRestic() (restic *Restic, err error) {

	// Find restic executable in PATH
	programName := ResticProgramName()
	resticProgram := program.Find(programName, "Restic")
	if resticProgram == nil {
		return nil, fmt.Errorf("unable to find '%s'", programName)
	}

	// Get the version
	versionstring, _, code, _ := resticProgram.Run("version")
	if code != 0 {
		return nil, fmt.Errorf("failed to fetch restic version from %s", resticProgram.Path)
	}
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

// NewResticFromPath creates a new Restic struct from the given file path
func NewResticFromPath(path string) (restic *Restic, err error) {

	// Ensure given path is an abs path
	path, err = filepath.Abs(path)
	if err != nil {
		return nil, err
	}

	// Ensure path is valid
	fileInfo, err := os.Stat(path)
	if err != nil || fileInfo.IsDir() {
		return nil, os.ErrNotExist
	}

	// Create new restic program from path
	programName := ResticProgramName()
	resticProgram := &program.Program{
		Name:     "Restic",
		Filename: programName,
		Path:     path,
	}

	// Get the version
	versionstring, _, code, _ := resticProgram.Run("version")
	if code != 0 {
		return nil, fmt.Errorf("failed to fetch restic version from %s", resticProgram.Path)
	}
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
