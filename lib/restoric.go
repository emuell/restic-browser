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
		Title:                      "Please select a restic repository directory",
		Filters:                    []runtime.FileFilter{},
		ShowHiddenFiles:            true,
		CanCreateDirectories:       false,
		ResolvesAliases:            true,
		TreatPackagesAsDirectories: true,
	}
	dir, err := runtime.OpenDirectoryDialog(*r.context, options)
	if err != nil || !IsDirectoryARepository(dir) {
		return "", fmt.Errorf("directory doesn't look like a restic backup location")
	}
	return dir, nil
}

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

func (r *Restoric) GetFilesForPath(snapshotID string, path string) ([]*File, error) {
	snapshot := r.snapshots[snapshotID]
	if snapshot == nil {
		return nil, fmt.Errorf("%s is not a valid snapshot ID", snapshotID)
	}
	return r.repo.GetFiles(snapshot, path)
}
