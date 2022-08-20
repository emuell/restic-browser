package restic

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
}

// NewRepository creates a new Repository struct
func NewRepository(location Location, restic *Restic) *Repository {
	return &Repository{location: location, restic: restic}
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

func (r *Repository) GetSnapshots() ([]*Snapshot, error) {
	stdout, stderr, code, err := r.run("snapshots", "--json")
	if code != 0 || err != nil {
		return nil, fmt.Errorf(stderr)
	}
	var snapshots []*Snapshot
	if stdout == "null" {
		return nil, fmt.Errorf("no snapshots found")
	}
	err = json.Unmarshal([]byte(stdout), &snapshots)
	if err != nil {
		return nil, fmt.Errorf("failed to parse snapshot info: %s", err.Error())
	}

	if len(snapshots) == 0 {
		return nil, fmt.Errorf("no snapshots found")
	}
	return snapshots, nil
}

func (r *Repository) GetFiles(snapshot *Snapshot, path string) ([]*File, error) {

	stdout, stderr, code, _ := r.run("ls", snapshot.ID, "--json", path)
	if code != 0 {
		return nil, fmt.Errorf(stderr)
	}
	if stdout == "null" {
		return nil, fmt.Errorf("no files in path: '%s'", path)
	}

	var files []*File
	lines := strings.Split(r.normalizeNewlines(stdout), "\n")
	for index, line := range lines {
		if len(line) == 0 || line[0] != '{' || index == 0 {
			// Skip first/blank/malformed lines
			continue
		}
		var file File
		err := json.Unmarshal([]byte(line), &file)
		if err != nil {
			return nil, fmt.Errorf("failed to parse file info: %s", err.Error())
		}
		files = append(files, &file)
	}

	if len(files) == 0 {
		return nil, fmt.Errorf("no files in path: '%s'", path)
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

	// zip compression for folders and -a option was added in restic 0.12.0
	hasZipDumpSupport := r.restic.Version[0] > 1 ||
		(r.restic.Version[0] == 0 && r.restic.Version[1] >= 12)

	if file.Type == "dir" && !hasZipDumpSupport {
		return "", fmt.Errorf("your version of restic does not support folder dumps. " +
			"Please upgrade restic to version >= 0.12.0 to restore folders")
	}

	// open the target file for writing
	targetFileName := filepath.Join(targetPath, file.Name)
	if file.Type == "dir" {
		targetFileName += ".zip"
	}
	if fs.FileExists(targetFileName) {
		return "", fmt.Errorf("target file '%s' already exists", targetFileName)
	}
	// open target file
	targetFile, err := os.Create(targetFileName)
	if err != nil {
		return "", err
	}
	defer targetFile.Close()
	// run restic cmd
	stderr, code, _ := r.runRedirected(targetFile, "dump", "-a", "zip", snapshot.ID, file.Path)
	if code != 0 {
		return "", fmt.Errorf(stderr)
	}
	return targetFileName, nil
}

func (r *Repository) run(command ...string) (stdout, stderr string, code int, err error) {
	r.location.SetEnv()
	defer r.location.UnsetEnv()
	command = append(command, "--repo", r.location.PathOrBucketName())
	stdout, stderr, code, err = r.restic.Run(command)
	return
}

func (r *Repository) runRedirected(stdout *os.File, command ...string) (stderr string, code int, err error) {
	r.location.SetEnv()
	defer r.location.UnsetEnv()
	command = append(command, "--repo", r.location.PathOrBucketName())
	stderr, code, err = r.restic.RunRedirected(stdout, command)
	return
}

func (r *Repository) normalizeNewlines(str string) string {
	strBytes := []byte(str)
	// replace CR LF \r\n (windows) with LF \n (unix)
	strBytes = bytes.Replace(strBytes, []byte{13, 10}, []byte{10}, -1)
	// replace CF \r (mac) with LF \n (unix)
	strBytes = bytes.Replace(strBytes, []byte{13}, []byte{10}, -1)
	return string(strBytes)
}
