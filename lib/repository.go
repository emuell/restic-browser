package lib

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/leaanthony/sail/fs"
)

// Repository holds all information about a repository
type Repository struct {
	location Location
	restic   *Restic
	password string
}

// NewRepository creates a new Repository struct
func NewRepository(location Location, password string, restic *Restic) *Repository {
	return &Repository{location: location, password: password, restic: restic}
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
	r.location.SetEnv()
	os.Setenv("RESTIC_PASSWORD", r.password)
	defer func() {
		os.Setenv("RESTIC_PASSWORD", "")
		r.location.UnsetEnv()
	}()
	command = append(command, "--repo", r.location.Path)
	stdout, stderr, code, err = r.restic.Run(command)
	return
}

func (r *Repository) GetSnapshots() ([]*Snapshot, error) {
	stdout, stderr, code, err := r.run("snapshots", "--json")
	if code != 0 || err != nil {
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

func (r *Repository) GetFiles(snapshot *Snapshot, path string) ([]*File, error) {

	stdout, stderr, code, _ := r.run("ls", snapshot.ID, "--json", path)
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
		files = append(files, &file)
	}

	return files, nil
}

func (r *Repository) RestoreFile(snapshot *Snapshot, file *File, targetPath string) error {

	_, stderr, code, _ := r.run("restore", snapshot.ID, "--target", targetPath, "--include", file.Path)
	if code != 0 {
		return fmt.Errorf(stderr)
	}
	return nil
}

func (r *Repository) DumpFile(snapshot *Snapshot, file *File, targetPath string) (string, error) {

	// TODO: should pipe stdOut to a stream instead:
	// https://stackoverflow.com/questions/18986943/in-golang-how-can-i-write-the-stdout-of-an-exec-cmd-to-a-file

	// open the target file for writing
	targetFile := filepath.Join(targetPath, file.Name)
	if file.Type == "dir" {
		targetFile = targetFile + ".zip"
	}
	if fs.FileExists(targetFile) {
		return "", fmt.Errorf("Target file already exists")
	}
	stdout, stderr, code, _ := r.run("dump", "-a", "zip", snapshot.ID, file.Path)
	if code != 0 {
		return "", fmt.Errorf(stderr)
	}
	outfile, err := os.Create(targetFile)
	if err != nil {
		return "", err
	}
	defer outfile.Close()
	_, err = outfile.Write([]byte(stdout))
	if err != nil {
		return "", err
	}
	return targetFile, nil
}
