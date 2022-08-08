package restic

// contains all the data relating to a restic File
type File struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Path  string `json:"path"`
	UID   int    `json:"uid,omitempty"`
	Gid   int    `json:"gid,omitempty"`
	Size  int    `json:"size,omitempty"`
	Mode  int    `json:"mode,omitempty"`
	Mtime string `json:"mtime,omitempty"`
	Atime string `json:"atime,omitempty"`
	Ctime string `json:"ctime,omitempty"`
}
