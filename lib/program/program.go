package program

import (
	"os/exec"
	"path/filepath"
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
