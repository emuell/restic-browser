package lib

import (
	"path/filepath"
	"strings"

	"crypto/md5"

	"github.com/disiqueira/gotree"
)

var hash = md5.New()

type DirInfo struct {
	Files []*File
}

type Node struct {
	Name     string
	Children map[string]*Node
	File     *File
}

func NewNode(Name string, file *File) *Node {
	return &Node{Name: Name, Children: make(map[string]*Node), File: file}
}

func (n *Node) Dump() gotree.Tree {
	tree := gotree.New(n.Name)
	for _, child := range n.Children {
		tree.AddTree(child.Dump())
	}
	return tree
}

type VuetifyTreeNode struct {
	Name     string             `json:"name"`
	Type     string             `json:"type"`
	ID       string             `json:"id"`
	Children []*VuetifyTreeNode `json:"children"`
}

func (n *Node) ToVuetifyTree() *VuetifyTreeNode {
	result := &VuetifyTreeNode{
		Name:     n.Name,
		Children: make([]*VuetifyTreeNode, 0), //JSON gotcha
	}
	if n.File != nil {
		result.Type = n.File.Type
		result.ID = n.File.Path
	} else {
		result.Type = "root"
		result.ID = "root"
	}

	for _, child := range n.Children {
		result.Children = append(result.Children, child.ToVuetifyTree())
	}
	return result
}

func (n *Node) GetFilesForDirectory(path string) *DirInfo {
	splitPath := n.splitPathString(path)
	return n.getFilesForDirectoryPath(splitPath)
}

func (n *Node) getFilesForDirectoryPath(segments []string) *DirInfo {
	segmentName := segments[0]
	thisNode := n.Children[segmentName]
	if len(segments) > 1 {
		return thisNode.getFilesForDirectoryPath(segments[1:])
	}

	result := &DirInfo{}
	for _, file := range n.Children {
		result.Files = append(result.Files, file.File)
	}

	return result
}

func (n *Node) splitPathString(path string) []string {
	slashPath := filepath.ToSlash(path)

	if len(slashPath) > 0 {
		if slashPath[0] == '/' {
			slashPath = slashPath[1:]
		}
	}
	if len(slashPath) > 0 {
		if slashPath[len(slashPath)-1] == '/' {
			slashPath = slashPath[:len(slashPath)-1]
		}
	}
	return strings.Split(slashPath, "/")
}

func (n *Node) AddPath(file *File) {
	splitString := n.splitPathString(file.Path)
	n.addSegments(splitString, file)
}

func (n *Node) addSegments(segments []string, file *File) *Node {
	// If length is 1, return node
	if len(segments) == 1 {
		if n.Children[segments[0]] == nil {
			n.Children[segments[0]] = NewNode(segments[0], file)
		}
		return n.Children[segments[0]]
	}
	// If length > 1
	// get first segment
	currentSegment := segments[0]
	// Do we have a Node for this?
	if n.Children[currentSegment] == nil {
		n.Children[currentSegment] = NewNode(currentSegment, file)
	}

	return n.Children[currentSegment].addSegments(segments[1:], file)

}

// NewFileTree creates a tree for the given files
func NewFileTree(files []*File) *Node {
	rootNode := NewNode("/", nil)
	for _, file := range files {
		rootNode.AddPath(file)
	}
	return rootNode
}
