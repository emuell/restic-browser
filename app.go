package main

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"strings"

	"restic-browser/backend/open"
	"restic-browser/backend/restic"

	"github.com/pkg/errors"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/text/encoding/unicode"
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

// read a text file, skipping BOM headers if present
func readTextFile(filename string) ([]byte, error) {
	var (
		bomUTF8              = []byte{0xef, 0xbb, 0xbf}
		bomUTF16BigEndian    = []byte{0xfe, 0xff}
		bomUTF16LittleEndian = []byte{0xff, 0xfe}
	)
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	if bytes.HasPrefix(data, bomUTF8) {
		return data[len(bomUTF8):], nil
	}
	if !bytes.HasPrefix(data, bomUTF16BigEndian) && !bytes.HasPrefix(data, bomUTF16LittleEndian) {
		return data, nil
	}
	// UseBom means automatic endianness selection
	e := unicode.UTF16(unicode.BigEndian, unicode.UseBOM)
	return e.NewDecoder().Bytes(data)
}

// defaultRepoPassword determines the default restic repository password from the environment.
func defaultRepoPassword() (string, error) {
	passwordFile := os.Getenv("RESTIC_PASSWORD_FILE")
	if passwordFile != "" {
		s, err := readTextFile(passwordFile)
		if errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("%s does not exist", passwordFile)
		}
		return strings.TrimSpace(strings.Replace(string(s), "\n", "", -1)), err
	}
	password := os.Getenv("RESTIC_PASSWORD")
	return password, nil
}

func (r *ResticBrowserApp) DefaultRepoLocation() restic.Location {
	location := restic.Location{}
	location.Password, _ = defaultRepoPassword()
	repo := os.Getenv("RESTIC_REPOSITORY")
	if len(repo) == 0 {
		return location
	}
	type LocationInfo struct {
		prefix      string
		credentials []string
	}
	locationInfos := []LocationInfo{
		{prefix: "bs"},
		{prefix: "sftp"},
		{prefix: "rest"},
		{prefix: "rclone"},
		{prefix: "s3", credentials: []string{"AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"}},
		{prefix: "b2", credentials: []string{"B2_ACCOUNT_ID", "B2_ACCOUNT_KEY"}},
		{prefix: "azure", credentials: []string{"AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_KEY"}},
	}
	location.Prefix = ""
	location.Path = repo
	for _, locationInfo := range locationInfos {
		if strings.HasPrefix(repo, locationInfo.prefix+":") {
			location.Prefix = locationInfo.prefix
			location.Path = strings.Replace(repo, locationInfo.prefix+":", "", 1)
			for _, credential := range locationInfo.credentials {
				location.Credentials = append(location.Credentials,
					restic.EnvValue{Name: credential, Value: os.Getenv(credential)})
			}
			break
		}
	}
	return location
}

func (r *ResticBrowserApp) ReadPasswordFromFile() (string, error) {
	options := runtime.OpenDialogOptions{
		DefaultDirectory:           "",
		DefaultFilename:            "",
		Title:                      "Please select a password file",
		Filters:                    []runtime.FileFilter{},
		ShowHiddenFiles:            true,
		CanCreateDirectories:       false,
		ResolvesAliases:            true,
		TreatPackagesAsDirectories: true,
	}
	filename, err := runtime.OpenFileDialog(*r.context, options)
	if err == nil && filename == "" {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to show dialog: %s", err.Error())
	}
	bytes, err := readTextFile(filename)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %s", err.Error())
	}
	return strings.TrimSpace(strings.Replace(string(bytes), "\n", "", -1)), nil
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
	targetFilePath, err := r.repo.RestoreFile(snapshot, file, targetPath)
	if err != nil {
		return "", err
	}
	return targetFilePath, nil
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
