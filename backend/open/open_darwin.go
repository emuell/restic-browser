package open

import (
	"os/exec"
)

func openFileOrURL(url string) error {
	cmd := exec.Command("open", url)
	return cmd.Run()
}
