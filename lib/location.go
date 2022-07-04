package lib

import (
	"os"
)

type EnvValue struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Defines a repository location for restic
type Location struct {
	Prefix       string     `json:"prefix"`      // e.g. "b2"
	Path         string     `json:"path"`        // local path or url or bucket name
	Credientials []EnvValue `json:"credentials"` // optional env values
}

func (l *Location) SetEnv() error {
	for _, env := range l.Credientials {
		err := os.Setenv(env.Name, env.Value)
		if err != nil {
			return err
		}
	}
	return nil
}

func (l *Location) UnsetEnv() error {
	for _, env := range l.Credientials {
		err := os.Setenv(env.Name, "")
		if err != nil {
			return err
		}
	}
	return nil
}
