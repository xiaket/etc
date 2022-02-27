package main

import (
	"fmt"

	git "github.com/libgit2/git2go/v33"

	"os"
	"path/filepath"
	"strings"
	"time"
)

const START_BRACKET = "{"
const END_BRACKET = "}"
const GIT_UNCOMMITED = "+"
const GIT_UNSTAGED = "!"
const GIT_UNTRACKED = "?"
const GIT_STASHED = "¥"
const VENV_INDICATOR = "∇"
const CMD_EXIT_0_COLOR = 34
const CMD_EXIT_NON0_COLOR = 124
const CURRENT_PATH_COLOR = 33
const SHORT_PATH_COLOR = 15
const GIT_BRANCH_COLOR = 166
const GIT_STATUS_COLOR = 136
const VENV_COLOR = 166

// number of letters displayed for each path segment.
const SHORT_PATH_TRUNCATE = 3

// duration of time before we cancel the git op.
const GIT_TIMEOUT = 150 * time.Millisecond

func color(color_code int, msg string) string {
	return fmt.Sprintf("\\[\033[38;5;%dm\\]%s", color_code, msg)
}

// GitSearch will tell us whether we are in a git root and in a git tree.
func gitSearch() (bool, string) {
	dir, _ := filepath.Abs(".")
	dir, _ = filepath.EvalSymlinks(dir)
	if dir == "" {
		// Current working directory removed
		return false, ""
	}
	for dir != "/" {
		if filepath.Base(dir) == ".git" {
			return true, filepath.Dir(dir)
		}
		if _, err := os.Stat(filepath.Join(dir, "/.git")); err == nil {
			return true, dir
		}
		dir = filepath.Dir(dir)
	}
	return false, ""
}

// Cwd would output the current path, and reduce the length of the output.
// Example:
// /usr/local/lib/python2.7/site-packages -> /usr/loc/lib/pyt/site-packages
func cwd() string {
	var (
		short_name string
	)
	dir, _ := os.Getwd()
	dir = strings.Replace(dir, os.Getenv("HOME"), "~", 1)
	paths := strings.Split(dir, "/")
	short_paths := make([]string, len(paths))
	for i, path := range paths {
		if (len(path) < SHORT_PATH_TRUNCATE) || (i == len(paths)-1) {
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
		short_name = color(SHORT_PATH_COLOR, strings.Join(short_paths[:len(paths)-1], "/")+"/")
		short_name += color(CURRENT_PATH_COLOR, short_paths[len(paths)-1])
	}
	return short_name
}

// BranchName will give the name of the branch.
func branchName(repository *git.Repository) string {
	head, err := repository.Head()
	if err == nil {
		return prettyBranchName(head.Shorthand())
	} else {
		return "Unknown"
	}
}

// PrettyBranchName will replace repetitive names in the branch and
// truncate longer names.
func prettyBranchName(name string) string {
	if name == "master" || name == "main" {
		return "🏠"
	}
	const truncate = 15
	name = strings.Trim(name, "\n")
	name = strings.Replace(name, "feature/", "🔨/", 1)
	// the bugfix name could have many variants.
	name = strings.Replace(name, "bugfix/", "🐛/", 1)
	name = strings.Replace(name, "bug/", "🐛/", 1)
	name = strings.Replace(name, "fix/", "🐛/", 1)
	if len(name) > truncate {
		return name[:truncate-3] + "⁁" + name[len(name)-3:]
	} else {
		return name
	}
}

// GitSt will output the current git status.
func gitSt(repository *git.Repository) string {
	opts := &git.StatusOptions{}
	opts.Show = git.StatusShowIndexAndWorkdir
	opts.Flags = git.StatusOptIncludeUntracked | git.StatusOptRenamesHeadToIndex | git.StatusOptExcludeSubmodules
	sl, _ := repository.StatusList(opts)
	ec, _ := sl.EntryCount()

	has_uncommited := false
	has_unstaged := false
	has_untracked := false
	for i := 0; i < ec; i++ {
		item, _ := sl.ByIndex(i)
		if item.Status%32 != 0 {
			has_uncommited = true
		}
		if item.Status == 128 {
			has_untracked = true
		}
		if item.Status >= 256 {
			has_unstaged = true
		}
	}

	var status string
	if has_uncommited {
		status += GIT_UNCOMMITED
	}
	if has_unstaged {
		status += GIT_UNSTAGED
	}
	if has_untracked {
		status += GIT_UNTRACKED
	}
	if _, err := os.Stat(filepath.Join(repository.Path(), "refs/stash")); err == nil {
		status += GIT_STASHED
	}

	if len(status) != 0 {
		status = color(GIT_STATUS_COLOR, status)
	}
	return status
}

// GitPrompt will combine GitSt and BranchName and provide git info for prompt.
func gitPrompt() string {
	inside_git, dir := gitSearch()
	if !inside_git {
		return ""
	}
	repository, _ := git.OpenRepository(dir)
	branch_name := branchName(repository)

	channel := make(chan string, 1)
	go func() {
		text := gitSt(repository)
		channel <- text
	}()

	select {
	case git_st := <-channel:
		return color(GIT_BRANCH_COLOR, branch_name) + git_st
	case <-time.After(GIT_TIMEOUT):
		return color(GIT_BRANCH_COLOR, branch_name)
	}
}

// VenvPrompt will look for virtualenv def in environment.
func venvPrompt() string {
	env_def := os.Getenv("VIRTUAL_ENV")
	if env_def == "" {
		return ""
	}
	path := os.Getenv("PATH")
	if !strings.HasPrefix(path, env_def) {
		return ""
	}
	return color(VENV_COLOR, VENV_INDICATOR)
}

func main() {
	var last_color = CMD_EXIT_NON0_COLOR
	if len(os.Args) == 1 || os.Args[1] == "0" {
		last_color = CMD_EXIT_0_COLOR
	}
	prompt := venvPrompt()
	prompt += color(last_color, START_BRACKET)
	gitPrompt := gitPrompt()
	if len(gitPrompt) != 0 {
		prompt += gitPrompt + " "
	}
	prompt += cwd()
	prompt += color(last_color, END_BRACKET)
	prompt += "\\[\033[0m\\]"
	fmt.Println(prompt)
}
