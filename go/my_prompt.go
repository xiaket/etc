package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

var SHORT_PATH_TRUNCATE = 3

// ColorIt would return a function that will paint a string using a color
// specified by a name. We will try to load color from environment first.
func ColorIt(name string) func(string) string {
	var default_colors = map[string]string{
		"COLOR_SHORTPATH":   "15",
		"COLOR_CURRENTPATH": "33",
		"COLOR_GITBRANCH":   "166",
		"COLOR_GITSTATUS":   "136",
		"COLOR_VENV":        "166",
		"COLOR_LAST_GOOD":   "34",
		"COLOR_LAST_FAIL":   "124",
	}
	color := os.Getenv(name)
	if color == "" {
		color = default_colors[name]
	}
	return func(msg string) string {
		buf := bytes.NewBufferString("\\[\033[")
		buf.WriteString("38;5;" + color)
		buf.WriteRune('m')
		buf.WriteString("\\]" + msg)
		return buf.String()
	}
}

func Symbols(name string) string {
	var default_symbols = map[string]string{
		"GIT_UNCOMMITED": "+",
		"GIT_UNSTAGED":   "!",
		"GIT_UNTRACKED":  "?",
		"GIT_STASHED":    "¥",
		"HAS_VENV":       "∇",
		"START_BRACKET":  "{",
		"END_BRACKET":    "}",
	}
	symbol := os.Getenv(name)
	if symbol == "" {
		symbol = default_symbols[name]
	}
	return symbol
}

// GitSearch will tell us whether we are in a git root and in a git tree.
func GitSearch() (bool, bool) {
	dir, _ := filepath.Abs(".")
	dir, _ = filepath.EvalSymlinks(dir)
	if dir == "" {
		// Current working directory removed
		return false, false
	}
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

// Cwd would output the current path, and reduce the length of the output.
// Example:
// /usr/local/lib/python2.7/site-packages -> /us/lo/li/py/site-packages
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
				short_paths[i] = path[:SHORT_PATH_TRUNCATE+1]
			} else {
				short_paths[i] = path[:SHORT_PATH_TRUNCATE]
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

// BranchName will give the name of the branch.
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

// PrettyBranchName will replace repetitive names in the branch and
// truncate longer names.
func PrettyBranchName(name string) string {
	const truncate = 15
	name = strings.Trim(name, "\n")
	name = strings.Replace(name, "feature/", "𝞿/", 1)
	// the bugfix name could have many variants.
	name = strings.Replace(name, "bugfix/", "𝛃/", 1)
	name = strings.Replace(name, "bug/", "𝛃/", 1)
	name = strings.Replace(name, "fix/", "𝛃/", 1)
	if len(name) > truncate {
		return name[:truncate-3] + "⁁" + name[len(name)-3:]
	} else {
		return name
	}
}

// GitSt will output the current git status.
func GitSt() string {
	// Commands copied from:
	// https://github.com/mathiasbynens/dotfiles/blob/master/.bash_prompt
	var status string
	GitStatus := ColorIt("COLOR_GITSTATUS")

	cmd := exec.Command("git", "update-index", "--really-refresh", "-q")
	cmd.Run()

	err := exec.Command("git", "diff", "--quiet", "--ignore-submodules", "--cached").Run()
	if err != nil {
		status += Symbols("GIT_UNCOMMITED")
	}

	err = exec.Command("git", "diff-files", "--quiet", "--ignore-submodules", "--").Run()
	if err != nil {
		status += Symbols("GIT_UNSTAGED")
	}

	err = exec.Command("git", "rev-parse", "--verify", "refs/stash").Run()
	if err == nil {
		status += Symbols("GIT_STASHED")
	}

	output, _ := exec.Command("git", "ls-files", "--others", "--exclude-standard").Output()
	if len(output) != 0 {
		status += Symbols("GIT_UNTRACKED")
	}

	if len(status) != 0 {
		status = GitStatus(status)
	}
	return status
}

// GitPrompt will combine GitSt and BranchName and provide git info for prompt.
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

// VenvPrompt will look for virtualenv def in environment.
func VenvPrompt() string {
	env_def := os.Getenv("VIRTUAL_ENV")
	if env_def == "" {
		return ""
	}
	path := os.Getenv("PATH")
	if !strings.HasPrefix(path, env_def) {
		return ""
	}
	return ColorIt("COLOR_VENV")(Symbols("HAS_VENV"))
}

func main() {
	var last_color_name string
	if len(os.Args) == 1 {
		last_color_name = "COLOR_LAST_GOOD"
	} else {
		if os.Args[1] == "0" {
			last_color_name = "COLOR_LAST_GOOD"
		} else {
			last_color_name = "COLOR_LAST_FAIL"
		}
	}
	prompt := VenvPrompt()
	prompt += ColorIt(last_color_name)(Symbols("START_BRACKET"))
	gitPrompt := GitPrompt()
	if len(gitPrompt) != 0 {
		prompt += gitPrompt + " "
	}
	prompt += Cwd()
	prompt += ColorIt(last_color_name)(Symbols("END_BRACKET"))
	prompt += "\\[\033[0m\\]"
	fmt.Println(prompt)
}
