package lib

import (
	"os"
)

type LocationType string

const (
	LocalPath LocationType = "local"
	Amazon    LocationType = "amazon"
	Backblaze LocationType = "backblaze"
	MSAzure   LocationType = "msazure"
)

type EnvValue struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Defines a repository location for restic
type Location struct {
	Type         LocationType `json:"type"`
	Prefix       string       `json:"prefix"`
	Path         string       `json:"path"`
	Credientials []EnvValue   `json:"credentials"`
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
