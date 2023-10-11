package open

import (
	"os/exec"
)

func openFileOrURL(url string) error {
	openCmd := "xdg-open"
	_, err := exec.LookPath(openCmd)
	if err != nil {
		return &exec.Error{Name: openCmd, Err: exec.ErrNotFound}
	}
	cmd := exec.Command(openCmd, url)
	return cmd.Run()
}
