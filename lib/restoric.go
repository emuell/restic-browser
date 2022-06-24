package lib

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type Restoric struct {
	restic    *Restic
	context   *context.Context
	repo      *Repository
	snapshots map[string]*Snapshot
}

func NewRestoric(restic *Restic) *Restoric {
	return &Restoric{
		restic:    restic,
		snapshots: make(map[string]*Snapshot),
	}
}

func (r *Restoric) Startup(ctx context.Context) {
	r.context = &ctx
}

func (r *Restoric) SelectRepo() (string, error) {
	options := runtime.OpenDialogOptions{
		DefaultDirectory:           "",
		DefaultFilename:            "",
		Title:                      "Please select a directory",
		Filters:                    make([]runtime.FileFilter, 0),
		ShowHiddenFiles:            true,
		CanCreateDirectories:       false,
		ResolvesAliases:            true,
		TreatPackagesAsDirectories: true,
	}
	dir, err := runtime.OpenDirectoryDialog(*r.context, options)
	// dir := "/Users/lea/Projects/restoric/test2"
	if err != nil || !IsDirectoryARepository(dir) {
		return "", fmt.Errorf("Invalid Repo Directory")
	}

	return dir, nil
}

func (r *Restoric) GetFilesForSnapshot(snapshotID string) (*VuetifyTreeNode, error) {
	snapshot := r.snapshots[snapshotID]
	if snapshot == nil {
		return nil, fmt.Errorf("%s is not a valid snapshot ID", snapshotID)
	}
	return r.repo.GetFilesForSnapshot(snapshot)
}

// func (r *Restoric) GetFilesForPath(snapshotID string, path string) ([]*File, error) {
// 	return []*File{NewDir("test", nil)}, nil
// }

// func (r *Restoric) SelectSnapshot(snapshotID string) ([]*File, error) {
// 	snapshot := r.snapshots[snapshotID]
// 	if snapshot == nil {
// 		return nil, fmt.Errorf("snapshot id %s does not exist", snapshotID)
// 	}

// 	// return snapshot.GetFilesForPath("/")
// }

func (r *Restoric) OpenRepo(dir, password string) ([]*Snapshot, error) {
	repo := NewRepository(dir, password, r.restic)
	snapshots, err := repo.GetSnapshots()
	if err != nil {
		return nil, err
	}
	r.repo = repo

	// Save snapshot details
	for _, snapshot := range snapshots {
		r.snapshots[snapshot.ID] = snapshot
	}

	return snapshots, nil
}

// Greet returns a greeting for the given name
func (a *Restoric) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
