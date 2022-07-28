package restic

import (
	"os"
)

type EnvValue struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Defines a repository location for restic
type Location struct {
	Prefix      string     `json:"prefix"`      // e.g. "b2"
	Path        string     `json:"path"`        // local path or url or bucket name
	Credentials []EnvValue `json:"credentials"` // optional env values
}

// return plain location path for local repositories, else prepends the prefix
func (l *Location) PathOrBucketName() string {
	bucketOrPath := l.Path
	if l.Prefix != "" {
		bucketOrPath = l.Prefix + ":" + bucketOrPath
	}
	return bucketOrPath
}

// Set env values from credentials
func (l *Location) SetEnv() error {
	for _, env := range l.Credentials {
		err := os.Setenv(env.Name, env.Value)
		if err != nil {
			return err
		}
	}
	return nil
}

// Unset env values from credentials
func (l *Location) UnsetEnv() error {
	for _, env := range l.Credentials {
		err := os.Setenv(env.Name, "")
		if err != nil {
			return err
		}
	}
	return nil
}
