# etc

Personal configurations and scripts for my Mac (with some Linux bits).
Maintained and evolved over many years.

## Layout

| Path | Purpose |
| --- | --- |
| `bashrc`, `alias`, `bash_functions` | Bash setup, aliases and helper functions |
| `nvim/` | Neovim configuration (lazy.nvim based) |
| `kitty/` | Kitty terminal configuration |
| `hammerspoon/` | Hammerspoon automation for macOS |
| `gitconfig`, `git-hooks/` | Git configuration and hooks |
| `bin/` | Small personal scripts and tools |
| `ps1/` | Custom shell prompt, written in Rust |
| `murmur/` | Rust utility project |
| `containers/` | Container-related configuration |
| `Brewfile` | Homebrew packages |
| `bootstrap/` | Setup scripts for a new machine (macOS / openSUSE) |
| `linux/`, `xremap/` | Linux-specific configuration |

Other top-level files are dotfiles for individual tools (readline, python,
fzf, atuin, mpv, etc.).

## Highlights

### A smarter `cd` (`bash_functions`)

The `cd` wrapper adds a few conveniences on top of the builtin:

- **Bookmarks**: `cd =<name>` jumps to the directory configured in the
  `CD_BOOKMARK_<name>` environment variable — e.g. `cd =e` goes to this repo.
  A value starting with `!` is executed and its output used as the target,
  so `CD_BOOKMARK_g='!git rev-parse --show-toplevel'` makes `cd =g` jump to
  the current git repo root. Defaults live in `bashrc`.
- **cd to a file**: `cd path/to/file.txt` changes into the file's directory
  instead of failing.
- **Fuzzy directory jump**: `cd name` with no matching directory in `.`
  searches subdirectories with `find`; a unique match is entered directly,
  multiple matches are listed.

Other small helpers include `mk` (mark a command, re-run it with bare `mk`),
`vm` (toggle vi/emacs line editing), `act` (activate `.venv`/`venv`), and
`gm` (cd into a Python module's directory).

### Fast custom prompt (`ps1/`)

A Rust binary that renders the shell prompt, so it stays fast even in large
repos:

- **Exit-status colors**: the surrounding `{ }` brackets are green when the
  last command succeeded, red when it failed.
- **Truncated paths**: intermediate path segments are shortened to 3 chars
  (`/usr/local/lib/python2.7/site-packages` → `/usr/loc/lib/pyt/site-packages`),
  with the last segment kept intact and highlighted.
- **Git awareness**: shows the current branch (with `master`/`main` displayed
  as 🏠, and `feature/`, `bugfix/` prefixes as 🔨/🐛) plus status flags —
  `+` staged, `!` modified, `?` untracked, `¥` stashed.
- **Virtualenv indicator**: a `∇` appears when a virtualenv is active but not
  first on `PATH`.
- **Never blocks the shell**: git info is gathered concurrently with a 150 ms
  timeout, so the prompt renders promptly even when a repo is slow.

## Bootstrap

On a fresh macOS machine:

```sh
bootstrap/macos.sh
```

The script is idempotent: completed steps are recorded under
`~/.xiaket/var/run/done` and skipped on re-runs.

## Notes

These files are tailored to my own workflow — use them as a reference
rather than installing them wholesale.
