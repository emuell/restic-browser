package lib

// Snapshot hols snapshot info
type Snapshot struct {
	ID       string   `json:"id"`
	ShortID  string   `json:"short_id"`
	Time     string   `json:"time"`
	Paths    []string `json:"paths"`
	Hostname string   `json:"hostname"`
	Username string   `json:"username"`
}

func (s *Snapshot) GetFilesForPath(path string) ([]*File, error) {
	// TODO!
	return []*File{NewDir("test", nil)}, nil
}
