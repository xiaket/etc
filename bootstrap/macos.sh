#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# This stage does not have any prerequisites. We should run this after the first boot.
BASE_DIR="$HOME/.xiaket"
altdir="$BASE_DIR/alt"
if [ "$(uname -m)" = "arm64" ]; then
  brewdir=/opt/homebrew
else
  brewdir=/usr/local
fi

# helpers
check-done() {
  done_dir="$BASE_DIR/var/run/done"
  mkdir -p "$done_dir"
  func="${FUNCNAME[1]}"
  if [ -f "$done_dir/$func" ]; then
    return 1
  else
    return 0
  fi
}

touch-done() {
  done_dir="$BASE_DIR/var/run/done"
  func="${FUNCNAME[1]}"
  touch "$done_dir/$func"
}

# configuration steps
clone-etc() {
  check-done || return 0
  xcode-select --install 2> /dev/null || true

  mkdir -p "$BASE_DIR/share/github"

  while true; do
    has_git=$(git --version 2> /dev/null || echo "false")
    if [ "$has_git" != "false" ]; then
      break
    fi
    echo "sleeping"
    sleep 5
  done

  git clone https://github.com/xiaket/etc.git "$BASE_DIR/share/github/etc"
  ln -s "$BASE_DIR/share/github/etc" "$BASE_DIR/etc"
  touch-done
}

homebrew() {
  check-done || return 0
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  touch-done
}

homebrew-packages() {
  check-done || return 0
  homebrew

  brew update &&
    brew bundle install --cleanup --file="$BASE_DIR/etc/Brewfile" &&
    brew upgrade

  touch-done
}

python-packages() {
  check-done || return 0
  brew install pipx
  pipx install black icdiff poetry ptpython pyflakes pygments Snape
  touch-done
}

write-defaults() {
  check-done || return 0

  # disable the dashboard
  defaults write com.apple.dashboard mcx-disabled -bool TRUE
  sudo killall Dock

  # be quiet please finder
  defaults write com.apple.finder FinderSounds -bool FALSE
  sudo killall Finder

  # disable delay when
  defaults write com.apple.dock autohide-fullscreen-delayed -bool FALSE
  sudo killall Dock

  # minimize key repeat
  defaults write -g InitialKeyRepeat -int 10
  defaults write -g KeyRepeat -int 1

  # Disable smarts, I don't need your help thanks.
  defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
  defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false

  touch-done

  # Switch to previous tab using alt-a and next tab alt-s.
  #defaults write com.apple.Safari NSUserKeyEquivalents '{
  #    "Show Previous Tab"="~a";
  #    "Show Next Tab"="~s";
  #    "Close Tab"="~q";
  #  }'
}

build-ps1() {
  check-done || return 0
  cd "$BASE_DIR/share/github/etc/ps1"
  $brewdir/bin/cargo build --release
  strip target/release/ps1
  mv target/release/ps1 ../bin
  touch-done
}

# Create or repair one symlink. Unlike a bare `ln -sf`, this is safe to run
# repeatedly: `ln -sf` follows an existing symlink-to-a-directory and drops a
# nested link *inside* the target (~/.config/nvim/nvim), so -n is mandatory
# here. Anything that is not ours -- a real file, or an $altdir overlay that
# deliberately shadows the repo copy -- is reported and left alone.
link() {
  local src="$1" dst="$2" cur

  if [ ! -e "$src" ]; then
    echo "  MISS   $src does not exist, skipping $dst" >&2
    return 0
  fi

  if [ -L "$dst" ]; then
    if [ "$(realpath "$dst" 2> /dev/null)" = "$(realpath "$src" 2> /dev/null)" ]; then
      return 0
    fi
    cur=$(readlink "$dst")
    case "$cur" in
      "$altdir"/*)
        echo "  keep   $dst -> $cur (alt overlay)"
        return 0
        ;;
    esac
    ln -sfn "$src" "$dst"
    echo "  relink $dst -> $src (was $cur)"
    return 0
  fi

  if [ -e "$dst" ]; then
    echo "  SKIP   $dst: a real $([ -d "$dst" ] && echo directory || echo file) is in the way" >&2
    return 0
  fi

  ln -sfn "$src" "$dst"
  echo "  link   $dst -> $src"
}

# Deliberately NOT guarded by check-done: links are convergent state, not a
# one-off step, so this runs on every invocation and reports what it changed.
sync-links() {
  echo "> syncing links"
  mkdir -p "$HOME/.config"

  # for configuration in $HOME
  link "$BASE_DIR/etc/bashrc" "$HOME/.bashrc"
  link "$HOME/.bashrc" "$HOME/.bash_profile"
  link "$BASE_DIR/etc/gitconfig" "$HOME/.gitconfig"
  link "$BASE_DIR/etc/hammerspoon" "$HOME/.hammerspoon"
  link "$BASE_DIR/etc/inputrc" "$HOME/.inputrc"
  link "$BASE_DIR/etc/pythonrc" "$HOME/.pythonrc"
  link "$BASE_DIR/etc/snape.json" "$HOME/.snape.json"
  link "$BASE_DIR/etc/nvim" "$HOME/.vim"
  link "$BASE_DIR/share/github" "$HOME/.Github"
  link "$BASE_DIR/share/ssh" "$HOME/.ssh"

  # for configuration in .config
  link "$BASE_DIR/etc/nvim" "$HOME/.config/nvim"
  link "$BASE_DIR/etc/kitty" "$HOME/.config/kitty"

  # unversioned python/pip shims
  link "$brewdir/bin/python3" "$brewdir/bin/python"
  link "$brewdir/bin/pip3" "$brewdir/bin/pip"
}

misc-config() {
  check-done || return 0
  chsh -s /bin/bash
  nvim +qall
  (cd "$BASE_DIR/etc" && git remote set-url origin git@github.com:xiaket/etc.git)
  touch-done
}

clone-etc
write-defaults
homebrew
homebrew-packages
python-packages
build-ps1
sync-links
misc-config
