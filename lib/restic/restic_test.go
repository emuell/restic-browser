package restic

import (
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// get go package root path
// credits: https://github.com/peteole/testdata-loader/blob/master/dataLoader.go
func getBasePath() string {
	dir, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	for _, err := ioutil.ReadFile(filepath.Join(dir, "go.mod")); err != nil && len(dir) > 1; {
		dir = filepath.Dir(dir)
		_, err = ioutil.ReadFile(filepath.Join(dir, "go.mod"))
	}
	if len(dir) < 2 {
		panic("No go.mod found")
	}
	return dir
}

// get abs path of our test-repo
func getTestRepoPath() string {
	basePath := getBasePath()
	repoPath := filepath.Join(basePath, "lib", "restic", "test-repo")
	if _, err := os.Stat(repoPath); err != nil {
		panic(fmt.Errorf("failed to resolve test-repo at %s", repoPath))
	}
	return repoPath
}

// password for our test-repo
const testRepoPass = "test-repo-pass"

// test global IsDirectoryARepository helper
func TestResticRepoPath(t *testing.T) {
	repoPath := getTestRepoPath()
	if IsDirectoryARepository(getBasePath()) {
		t.Error("project root dir should not be treated like a valid restic repo")
	}
	if !IsDirectoryARepository(repoPath) {
		t.Error("test repo path should have been detected as valid restic repo")
	}
}

// test if restic program can be resolved and if it can be launched to query version info
func TestResticProgram(t *testing.T) {
	restic, err := NewRestic()
	if err != nil {
		t.Fatal("failed to resolve restic binary", err)
	}
	if len(strings.Split(restic.Version, ".")) != 3 {
		t.Error("unexpected restic version number")
	}
}

// test opening repo and fetching snapshots
func TestResticSnapshots(t *testing.T) {
	repoPath := getTestRepoPath()
	restic, err := NewRestic()
	if err != nil {
		t.Fatal("failed to resolve restic binary", err)
	}
	// open repo and fetch snapshots
	repoWrongPath := NewRepository(Location{Path: getBasePath(), Password: testRepoPass}, restic)
	if _, err = repoWrongPath.GetSnapshots(); err == nil {
		t.Error("expecting an error when fetching snapshots for invalid location")
	}
	repoWrongPass := NewRepository(Location{Path: repoPath, Password: "wrong-password"}, restic)
	if _, err = repoWrongPass.GetSnapshots(); err == nil {
		t.Error("expecting an error when fetching snapshots with wrong password")
	}
	repo := NewRepository(Location{Path: repoPath, Password: testRepoPass}, restic)
	snapshots, err := repo.GetSnapshots()
	if err != nil {
		t.Fatal("failed to fetch snapshots")
	}
	// test snapshot serialization
	for _, s := range snapshots {
		// NB: tag may be empty
		if s.ID == "" || s.ShortID == "" {
			t.Error("missing snapshot id properties")
		} else if len(s.Paths) == 0 || s.Time == "" || s.Hostname == "" || s.Username == "" {
			t.Error("missing snapshot properties")
		}
	}
}

// test opening repo and fetching files
func TestResticFiles(t *testing.T) {
	repoPath := getTestRepoPath()
	restic, err := NewRestic()
	if err != nil {
		t.Fatal("failed to resolve restic binary", err)
	}
	// open repo and fetch snapshots
	repo := NewRepository(Location{Path: repoPath, Password: testRepoPass}, restic)
	snapshots, err := repo.GetSnapshots()
	if err != nil {
		t.Error("failed to fetch snapshots")
	}
	invalidSnapshot := &Snapshot{ID: "INVALID_ID"}
	_, err = repo.GetFiles(invalidSnapshot, "/")
	if err == nil {
		t.Error("expecting an error for invalid snapshot ids")
	}
	randSnapshot := snapshots[rand.Intn(len(snapshots)-1)]
	// fetch files
	_, err = repo.GetFiles(randSnapshot, "/INVALID_PATH")
	if err == nil {
		t.Error("expecting an error for invalid snapshot paths")
	}
	files, err := repo.GetFiles(randSnapshot, "/")
	if err != nil || len(files) == 0 {
		t.Fatal("failed to fetch files")
	}
	// test file serialization
	for _, f := range files {
		// NB: UID and Gid may be empty
		if f.Type != "file" && f.Type != "dir" {
			t.Errorf("unexpected file type property: %s", f.Type)
		} else if f.Atime == "" || f.Ctime == "" || f.Mtime == "" {
			t.Error("missing file time properties", f)
		} else if f.Name == "" || f.Path == "" || f.Mode == 0 || (f.Type == "file" && f.Size == 0) {
			t.Error("missing or unexpected file properties", f)
		}
	}
}

func TestResticFileDump(t *testing.T) {
	repoPath := getTestRepoPath()
	restic, err := NewRestic()
	if err != nil {
		t.Fatal("failed to resolve restic binary", err)
	}
	// open repo and fetch a random file
	repo := NewRepository(Location{Path: repoPath, Password: testRepoPass}, restic)
	snapshots, err := repo.GetSnapshots()
	if err != nil {
		t.Error("failed to fetch snapshots")
	}
	randSnapshot := snapshots[rand.Intn(len(snapshots)-1)]
	files, err := repo.GetFiles(randSnapshot, "/")
	if err != nil || len(files) == 0 {
		t.Fatal("failed to fetch files")
	}
	// dump file to temp
	randFile := files[rand.Intn(len(files)-1)]
	restoredFilePath, err := repo.DumpFile(randSnapshot, randFile, t.TempDir())
	if err != nil || len(restoredFilePath) == 0 {
		t.Fatal("failed to restore file")
	}
	restoredFile, err := ioutil.ReadFile(restoredFilePath)
	if err != nil || len(restoredFile) == 0 {
		t.Error("failed to read restored file")
	}
}
