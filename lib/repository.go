package lib

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/leaanthony/sail/fs"
)

// Repository holds all information about a repository
type Repository struct {
	path               string
	restic             *Restic
	password           string
	snapshotFiles      map[string]*File
	repositoryFileTree *Node
	snapshots          map[string]*Snapshot
}

// NewRepository creates a new Repository struct
func NewRepository(path string, password string, restic *Restic) *Repository {
	return &Repository{path: path, password: password, restic: restic}
}

// IsDirectoryARepository returns true if the given directory contains everything a
// restic repository contains
func IsDirectoryARepository(basedir string) bool {

	// Check config file exists
	if !fs.FileExists(path.Join(basedir, "config")) {
		return false
	}

	// Check repo dirs exist
	repodirs := []string{"data", "index", "keys", "locks", "snapshots"}
	for _, dir := range repodirs {
		if !fs.DirExists(path.Join(basedir, dir)) {
			return false
		}
	}

	return true
}

func (r *Repository) run(command ...string) (stdout, stderr string, code int, err error) {
	os.Setenv("RESTIC_PASSWORD", r.password)
	command = append(command, "--repo", r.path)
	stdout, stderr, code, err = r.restic.Run(command)
	os.Setenv("RESTIC_PASSWORD", "")
	return
}

// Init initialises the repository
func (r *Repository) Init(path string) error {
	_, stderr, _, _ := r.run("init")
	if stderr != "" {
		return fmt.Errorf(stderr)
	}

	return nil
}

func (r *Repository) GetSnapshots() ([]*Snapshot, error) {
	stdout, stderr, code, err := r.run("snapshots", "--json")
	if code != 0 {
		return nil, fmt.Errorf(stderr)
	}
	var snapshots []*Snapshot
	if stdout == "null" {
		return snapshots, nil
	}
	err = json.Unmarshal([]byte(stdout), &snapshots)
	if err != nil {
		return nil, err
	}

	return snapshots, nil
}

// Credit: https://www.programming-books.io/essential/go/normalize-newlines-1d3abcf6f17c4186bb9617fa14074e48#9cdc1dd890594c15b58894a737968c8d
func (r *Repository) normalizeNewlines(in string) string {
	d := []byte(in)
	// replace CR LF \r\n (windows) with LF \n (unix)
	d = bytes.Replace(d, []byte{13, 10}, []byte{10}, -1)
	// replace CF \r (mac) with LF \n (unix)
	d = bytes.Replace(d, []byte{13}, []byte{10}, -1)
	return string(d)
}

func (r *Repository) GetFilesForDirectory(dir string) (*DirInfo, error) {
	if r.repositoryFileTree == nil {
		return nil, fmt.Errorf("call GetFilesForSnapshot first")
	}

	return r.repositoryFileTree.GetFilesForDirectory(dir), nil

}

func (r *Repository) GetFilesForSnapshot(snapshot *Snapshot) (*VuetifyTreeNode, error) {

	var result *Node
	r.snapshotFiles = make(map[string]*File)

	stdout, stderr, code, _ := r.run("ls", snapshot.ID, "--json")
	if code != 0 {
		return nil, fmt.Errorf(stderr)
	}

	var files []*File
	if stdout == "null" {
		return nil, nil
	}

	lines := strings.Split(r.normalizeNewlines(stdout), "\n")
	for index, line := range lines {
		// Skip first/blank/malformed lines
		if len(line) == 0 || line[0] != '{' || index == 0 {
			continue
		}
		var file File
		err := json.Unmarshal([]byte(line), &file)
		if err != nil {
			return nil, err
		}

		r.snapshotFiles[line] = &file

		files = append(files, &file)
	}

	result = NewFileTree(files)
	r.repositoryFileTree = result
	return result.ToVuetifyTree(), nil
}
