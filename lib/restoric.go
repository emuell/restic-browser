package lib

import "github.com/wailsapp/wails"
import "fmt"

type Restoric struct {
	restic    *Restic
	runtime   *wails.Runtime
	repo      *Repository
	snapshots map[string]*Snapshot
}

func NewRestoric(restic *Restic) *Restoric {
	return &Restoric{
		restic:    restic,
		snapshots: make(map[string]*Snapshot),
	}
}

func (r *Restoric) SelectRepo() (string, error) {
	// dir := r.runtime.Dialog.SelectDirectory()
	dir := "/Users/lea/Projects/restoric/test2"
	if !IsDirectoryARepository(dir) {
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

func (r *Restoric) WailsInit(runtime *wails.Runtime) error {
	r.runtime = runtime
	return nil
}
