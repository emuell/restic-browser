package lib

import (
	"path/filepath"
	"strings"
	e "github.com/leaanthony/sail/errors"
	p "github.com/leaanthony/sail/program"
)

// Restic holds information about the Restic Binary
type Restic struct {
	VersionString string
	Version string

	restic *p.Program
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
func NewRestic(restic *p.Program) (*Restic, error) {
	
	// Get the version
	versionstring, _, code, _ := restic.Run("version")
	if code != 0 {
		return nil, e.New(badVersion)
	}

	// Find restic version
	version := "unknown"
	splitVersion := strings.Split(versionstring, " ")
	if len(splitVersion) > 2 {
		version = splitVersion[1]
	}

	result := &Restic{
		VersionString: versionstring,
		Version: version,
		restic: restic,
	}

	return result, nil
}


