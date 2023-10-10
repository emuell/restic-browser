package restic

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"restic-browser/backend/program"
)

// Restic holds information about the Restic Binary
type Restic struct {
	Version [3]int // major, minor, rev
	restic  *program.Program
}

// Run restic program and return stdout and err, exitCode and error.
func (r *Restic) Run(command []string) (stdout, stderr string, code int, err error) {
	stdout, stderr, code, err = r.restic.Run(command...)
	// see https://github.com/restic/restic/issues/4144
	stdout = strings.ReplaceAll(stdout, "b2_download_file_by_name: 404: : b2.b2err", "")
	return stdout, stderr, code, err
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

// resticVersionNumber gets the restic version from the restic program
func resticVersionNumber(resticProgram *program.Program) ([3]int, error) {
	versionstring, _, code, _ := resticProgram.Run("version")
	if code != 0 {
		return [3]int{0, 0, 0}, fmt.Errorf("failed to fetch restic version from %s", resticProgram.Path)
	}
	version := [3]int{0, 0, 0}
	splitVersion := strings.Split(versionstring, " ") // "restic x.y.z some other info"
	if len(splitVersion) > 2 {
		versionSplits := strings.Split(splitVersion[1], ".") // "x.y.z"
		if len(versionSplits) > 2 {
			major, err := strconv.ParseInt(versionSplits[0], 10, 32)
			if err != nil {
				major = 0
			}
			minor, err := strconv.ParseInt(versionSplits[1], 10, 32)
			if err != nil {
				minor = 0
			}
			rev, err := strconv.ParseInt(versionSplits[2], 10, 32)
			if err != nil {
				rev = 0
			}
			version[0] = int(major)
			version[1] = int(minor)
			version[2] = int(rev)
		}
	}
	return version, nil
}

// NewRestic creates a new Restic struct
func NewRestic(resticPath* string) (restic *Restic, err error) {
	// Get restic from args or find restic executable in PATH
	var resticProgram *program.Program;
	if resticPath != nil && len(*resticPath) > 0 {
		_, err := os.Stat(*resticPath)
		if err != nil {
			return nil, err
		}
		resticProgram = &program.Program{
			Name:     "Restic",
			Filename: filepath.Base(*resticPath),
			Path:     *resticPath,
		}
	} else {
		programName := ResticProgramName()
		resticProgram = program.Find(programName, "Restic")
		if resticProgram == nil {
			return nil, fmt.Errorf("unable to find '%s' in $PATH", programName)
		}
	}

	// Get the version
	version, err := resticVersionNumber(resticProgram)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to fetch restic version from %s: %s", resticProgram.Path, err.Error())
	}

	restic = &Restic{
		Version: version,
		restic:  resticProgram,
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
	version, err := resticVersionNumber(resticProgram)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to fetch restic version from %s: %s", resticProgram.Path, err.Error())
	}

	restic = &Restic{
		Version: version,
		restic:  resticProgram,
	}

	return restic, nil
}
