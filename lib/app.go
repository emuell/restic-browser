package lib

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"strings"

	"github.com/emuell/restic-browser/lib/open"
	"github.com/emuell/restic-browser/lib/restic"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type ResticBrowserApp struct {
	context     *context.Context
	tempPath    string
	restic      *restic.Restic
	resticError error
	repo        *restic.Repository
	snapshots   map[string]*restic.Snapshot
}

func NewResticBrowser() *ResticBrowserApp {
	program, err := restic.NewRestic()
	if err != nil {
		// continue without a valid restic instance
		fmt.Print(err.Error() + "\n")
	}
	return &ResticBrowserApp{
		restic:      program,
		resticError: err,
		snapshots:   make(map[string]*restic.Snapshot),
	}
}

func (r *ResticBrowserApp) showWarning(title, message string) {
	r.showMessage(title, message, "warning")
}

func (r *ResticBrowserApp) showError(title, message string) {
	r.showMessage(title, message, "error")
}

func (r *ResticBrowserApp) showMessage(title, message string, messageType runtime.DialogType) {
	messageOptions := runtime.MessageDialogOptions{
		Type:    messageType,
		Title:   title,
		Message: message,
		Buttons: []string{"Okay"},
	}
	_, err := runtime.MessageDialog(*r.context, messageOptions)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to show error message: %s\n", err.Error())
	}
}

func (r *ResticBrowserApp) Startup(ctx context.Context) {
	// memorize context
	r.context = &ctx
	// create app temp dir
	tempPath, err := ioutil.TempDir(os.TempDir(), "restic-browser")
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create app temp dir: %s\n", err.Error())
	}
	r.tempPath = tempPath
}

func (r *ResticBrowserApp) DomReady(ctx context.Context) {
	// warn about missing restic program: this is the first time we can show a dialog
	if r.restic == nil {
		message := fmt.Sprintf(
			"Failed to find a restic program in your $PATH: %s\n\n", r.resticError.Error()) +
			"Please select your installed restic binary manually in the following dialog."
		r.showWarning("Restic Binary Missing", message)
		selectFileOptions := runtime.OpenDialogOptions{
			DefaultFilename:            restic.ResticProgramName(),
			Title:                      "Please select your restic program",
			ShowHiddenFiles:            true,
			TreatPackagesAsDirectories: true,
		}
		// then ask to locate the restic binary manually
		path, err := runtime.OpenFileDialog(ctx, selectFileOptions)
		if err == nil && path != "" {
			r.restic, err = restic.NewResticFromPath(path)
			if err != nil {
				r.showError("Restic Binary Error",
					fmt.Sprintf("Failed to set restic binary: %s", err.Error()))
			}
		}
	}
}

func (r *ResticBrowserApp) Shutdown(ctx context.Context) {
	// remove app temp dir
	err := os.RemoveAll(r.tempPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to remove app temp dir: %s\n", err.Error())
	}
}

func (r *ResticBrowserApp) OpenFileOrUrl(path string) error {
	return open.OpenFileOrURL(path)
}

func (r *ResticBrowserApp) DefaultRepo() (location restic.Location, pass string) {
	repo := os.Getenv("RESTIC_REPOSITORY")
	if len(repo) == 0 {
		return
	}
	location.Password = os.Getenv("RESTIC_PASSWORD")
	if strings.HasPrefix(repo, "bs:") {
		location.Prefix = "bs"
		location.Path = strings.Replace(repo, "bs:", "", 1)
	} else if strings.HasPrefix(repo, "sftp:") {
		location.Prefix = "sftp"
		location.Path = strings.Replace(repo, "sftp:", "", 1)
	} else if strings.HasPrefix(repo, "rest:") {
		location.Prefix = "rest"
		location.Path = strings.Replace(repo, "rest:", "", 1)
	} else if strings.HasPrefix(repo, "rclone:") {
		location.Prefix = "rclone"
		location.Path = strings.Replace(repo, "rclone:", "", 1)
	} else if strings.HasPrefix(repo, "s3:") {
		location.Prefix = "s3"
		location.Path = strings.Replace(repo, "s3:", "", 1)
		location.Credentials = append(location.Credentials,
			restic.EnvValue{Name: "AWS_ACCESS_KEY_ID", Value: os.Getenv("AWS_ACCESS_KEY_ID")})
		location.Credentials = append(location.Credentials,
			restic.EnvValue{Name: "AWS_SECRET_ACCESS_KEY", Value: os.Getenv("AWS_SECRET_ACCESS_KEY")})
	} else if strings.HasPrefix(repo, "b2:") {
		location.Prefix = "b2"
		location.Path = strings.Replace(repo, "b2:", "", 1)
		location.Credentials = append(location.Credentials,
			restic.EnvValue{Name: "B2_ACCOUNT_ID", Value: os.Getenv("B2_ACCOUNT_ID")})
		location.Credentials = append(location.Credentials,
			restic.EnvValue{Name: "B2_ACCOUNT_KEY", Value: os.Getenv("B2_ACCOUNT_ID")})
	} else if strings.HasPrefix(repo, "azure:") {
		location.Prefix = "azure"
		location.Path = strings.Replace(repo, "azure:", "", 1)
		location.Credentials = append(location.Credentials,
			restic.EnvValue{Name: "AZURE_ACCOUNT_NAME", Value: os.Getenv("AZURE_ACCOUNT_NAME")})
		location.Credentials = append(location.Credentials,
			restic.EnvValue{Name: "AZURE_ACCOUNT_KEY", Value: os.Getenv("B2_ACCOUNT_KEY")})
	} else {
		location.Prefix = ""
		location.Path = repo
	}
	return
}

func (r *ResticBrowserApp) SelectLocalRepo() (string, error) {
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
	if err == nil && dir == "" {
		return "", nil
	}
	if err != nil || !restic.IsDirectoryARepository(dir) {
		return "", fmt.Errorf("directory doesn't look like a restic backup location")
	}
	return dir, nil
}

func (r *ResticBrowserApp) OpenRepo(location restic.Location) ([]*restic.Snapshot, error) {
	if r.restic == nil {
		return nil, fmt.Errorf("failed to find restic program")
	}
	repo := restic.NewRepository(location, r.restic)
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

func (r *ResticBrowserApp) GetFilesForPath(snapshotID, path string) ([]*restic.File, error) {
	snapshot := r.snapshots[snapshotID]
	if snapshot == nil {
		return nil, fmt.Errorf("%s is not a valid snapshot ID", snapshotID)
	}
	return r.repo.GetFiles(snapshot, path)
}

func (r *ResticBrowserApp) RestoreFile(snapshotID string, file *restic.File) (string, error) {
	snapshot := r.snapshots[snapshotID]
	if snapshot == nil {
		return "", fmt.Errorf("%s is not a valid snapshot ID", snapshotID)
	}
	options := runtime.OpenDialogOptions{
		DefaultDirectory:           "",
		DefaultFilename:            "",
		Title:                      "Please select a target directory",
		Filters:                    []runtime.FileFilter{},
		ShowHiddenFiles:            true,
		CanCreateDirectories:       true,
		ResolvesAliases:            true,
		TreatPackagesAsDirectories: true,
	}
	targetPath, err := runtime.OpenDirectoryDialog(*r.context, options)
	if err != nil {
		return "", err
	}
	if targetPath == "" {
		return "", nil
	}
	err = r.repo.RestoreFile(snapshot, file, targetPath)
	if err != nil {
		return "", err
	}
	return targetPath, nil
}

func (r *ResticBrowserApp) DumpFile(snapshotID string, file *restic.File) (string, error) {
	snapshot := r.snapshots[snapshotID]
	if snapshot == nil {
		return "", fmt.Errorf("%s is not a valid snapshot ID", snapshotID)
	}
	options := runtime.OpenDialogOptions{
		DefaultDirectory:           "",
		DefaultFilename:            "",
		Title:                      "Please select a target directory",
		Filters:                    []runtime.FileFilter{},
		ShowHiddenFiles:            true,
		CanCreateDirectories:       true,
		ResolvesAliases:            true,
		TreatPackagesAsDirectories: true,
	}
	targetPath, err := runtime.OpenDirectoryDialog(*r.context, options)
	if err != nil {
		return "", err
	}
	if targetPath == "" {
		return "", nil
	}
	var targetFilePath string
	targetFilePath, err = r.repo.DumpFile(snapshot, file, targetPath)
	if err != nil {
		return "", err
	}
	return targetFilePath, nil
}

func (r *ResticBrowserApp) DumpFileToTemp(snapshotID string, file *restic.File) (string, error) {
	snapshot := r.snapshots[snapshotID]
	if snapshot == nil {
		return "", fmt.Errorf("%s is not a valid snapshot ID", snapshotID)
	}
	targetPath, err := ioutil.TempDir(r.tempPath, "dump")
	if err != nil {
		return "", err
	}
	targetFilePath, err := r.repo.DumpFile(snapshot, file, targetPath)
	if err != nil {
		return "", err
	}
	return targetFilePath, nil
}
