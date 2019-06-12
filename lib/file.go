package lib

import (
	"fmt"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// File contains all the data relating to a restic File
type File struct {
	Name       string           `json:"name"`
	Type       string           `json:"type"`
	Path       string           `json:"path"`
	UID        int              `json:"uid,omitempty"`
	Gid        int              `json:"gid,omitempty"`
	Size       int              `json:"size,omitempty"`
	Mode       int              `json:"mode,omitempty"`
	Mtime      time.Time        `json:"mtime,omitempty"`
	Atime      time.Time        `json:"atime,omitempty"`
	Ctime      time.Time        `json:"ctime,omitempty"`
	StructType string           `json:"struct_type,omitempty"`
	Children   map[string]*File `json:"children,omitempty"`
	Parent     *File            `json:"-"`
}

func NewDir(dirName string, parent *File) *File {
	return &File{
		Name:   dirName,
		Type:   "dir",
		Parent: parent,
	}
}

// IsDir returns true if the file is a directory
func (f *File) IsDir() bool {
	return f.Type == "dir"
}

func (f *File) AddDir(dir *File) {

	// Create map if it doesn't exist
	if f.Children == nil {
		f.Children = make(map[string]*File)
	}

	pathToDir := dir.Path

	// Convert slashes if needed
	if runtime.GOOS == "windows" {
		pathToDir = filepath.ToSlash(pathToDir)
	}

	// Break path up
	splitPath := strings.Split(pathToDir, "/")

	f.createDirPath(splitPath)

}

// Creates the directory path and returns the parent of the
func (f *File) createDirPath(path []string) *File {

	// Exit if we got to the end
	if len(path) == 1 {
		return f
	}

	// Check if the first part of the path exists
	pathNode := path[0]

	if f.Children[pathNode] == nil {
		// create it
		f.Children[pathNode] = NewDir(pathNode, f)
	}

	// recurse!
	return f.createDirPath(path[1:])
}

func (f *File) print(indent int, message string) {
	output := ""
	for i := 0; i < indent; i++ {
		output += " "
	}
	output += message
	fmt.Println(output)
}

func (f *File) Dump(indent int) {
	f.print(indent, fmt.Sprintf("Name: %s", f.Name))
	f.print(indent, fmt.Sprintf("Type: %s", f.Type))
	for _, child := range f.Children {
		child.Dump(indent + 2)
	}
}
