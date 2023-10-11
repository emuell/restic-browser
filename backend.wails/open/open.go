package open

import (
	"net/url"
	"path/filepath"
)

// OpenFileOrURL opens the given path or URL with the system's default app or browser.
func OpenFileOrURL(pathOrURL string) error {
	// pass urls as they are
	url, err := url.Parse(pathOrURL)
	if err == nil && (url.Scheme == "http" || url.Scheme == "https" || url.Scheme == "file") {
		return openFileOrURL(url.String())
	}
	// make path abs
	absPath, err := filepath.Abs(pathOrURL)
	if err != nil {
		return err
	}
	return openFileOrURL(absPath)
}
