package main

import (
	"bytes"
	"fmt"
	"github.com/mgutz/ansi"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ColorIt would return a function that will paint a string using a color
// specified by a name. We will try to load color from environment first.
func ColorIt(name string) func(string) string {
	var default_colors = map[string]string{
		"COLOR_SHORTPATH":   "15",
		"COLOR_CURRENTPATH": "33",
		"COLOR_GITBRANCH":   "166",
		"COLOR_GITSTATUS":   "136",
	}
	color := os.Getenv(name)
	if color == "" {
		color = default_colors[name]
	}
	return ansi.ColorFunc(color)
}

// GitSearch will tell us whether we are in a git root and in a git tree.
func GitSearch() (bool, bool) {
	dir, _ := filepath.Abs(".")
	dir, _ = filepath.EvalSymlinks(dir)
	for dir != "/" {
		if filepath.Base(dir) == ".git" {
			return true, false
		}
		if _, err := os.Stat(filepath.Join(dir, "/.git")); err == nil {
			return true, true
		}
		dir = filepath.Dir(dir)
	}
	return false, false
}

func Cwd() string {
	ShortPath := ColorIt("COLOR_SHORTPATH")
	CurrentPath := ColorIt("COLOR_CURRENTPATH")
	var (
		short_name string
	)
	dir, _ := os.Getwd()
	dir = strings.Replace(dir, os.Getenv("HOME"), "~", 1)
	paths := strings.Split(dir, "/")
	short_paths := make([]string, len(paths))
	for i, path := range paths {
		if (len(path) < 2) || (i == len(paths)-1) {
			short_paths[i] = path
		} else {
			if strings.HasPrefix(path, ".") {
				short_paths[i] = path[:3]
			} else {
				short_paths[i] = path[:2]
			}
		}
	}
	if len(paths) == 1 {
		short_name = short_paths[0]
	} else {
		short_name = ShortPath(strings.Join(short_paths[:len(paths)-1], "/") + "/")
		short_name += CurrentPath(short_paths[len(paths)-1])
	}
	return short_name
}

func BranchName() string {
	var out bytes.Buffer
	cmd := exec.Command("git", "symbolic-ref", "--quiet", "--short", "HEAD")
	cmd.Stdout = &out
	if cmd.Run() == nil {
		return PrettyBranchName(out.String())
	}
	cmd = exec.Command("git", "rev-parse", "--short", "HEAD")
	cmd.Stdout = &out
	if cmd.Run() == nil {
		return PrettyBranchName(out.String())
	} else {
		return "Unknown"
	}
}

func PrettyBranchName(name string) string {
	const truncate = 15
	name = strings.Trim(name, "\n")
	name = strings.Replace(name, "feature", "𝞿", 1)
	name = strings.Replace(name, "bugfix", "𝛃", 1)
	if len(name) > truncate {
		return name[:truncate-3] + "⁁" + name[len(name)-3:]
	} else {
		return name
	}
}

func GitSt() string {
	// Commands copied from:
	// https://github.com/mathiasbynens/dotfiles/blob/master/.bash_prompt
	var status string
	GitStatus := ColorIt("COLOR_GITSTATUS")

	cmd := exec.Command("git", "update-index", "--really-refresh", "-q")
	cmd.Run()

	err := exec.Command("git", "diff", "--quiet", "--ignore-submodules", "--cached").Run()
	if err != nil {
		status += "+"
	}

	err = exec.Command("git", "diff-files", "--quiet", "--ignore-submodules", "--").Run()
	if err != nil {
		status += "!"
	}

	err = exec.Command("git", "rev-parse", "--verify", "refs/stash").Run()
	if err == nil {
		status += "$"
	}

	output, _ := exec.Command("git", "ls-files", "--others", "--exclude-standard").Output()
	if len(output) != 0 {
		status += "?"
	}

	if len(status) != 0 {
		status = GitStatus(" " + status)
	}

	return status
}

func GitPrompt() string {
	inside_git, inside_tree := GitSearch()
	if !inside_git {
		return ""
	}
	GitBranch := ColorIt("COLOR_GITBRANCH")
	branchName := GitBranch(BranchName())

	if !inside_tree {
		return branchName
	}
	return branchName + GitSt()
}

func main() {
	gitPrompt := GitPrompt()
	pwd := Cwd()
	if len(gitPrompt) != 0 {
		fmt.Println(pwd + " " + gitPrompt)
	} else {
		fmt.Println(pwd)
	}
}
