#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# This stage does not have any prerequisites. We should run this after the first boot.
BASE_DIR="$HOME/.xiaket"
if [ "$(uname -m)" = "arm64" ]
then
  brewdir=/opt/homebrew
else
  brewdir=/usr/local
fi

# helpers
check-done () {
    done_dir="$BASE_DIR/var/run/done"
    mkdir -p "$done_dir"
    func="${FUNCNAME[1]}"
    if [ -f "$done_dir/$func" ]
    then
        return 1
    else
        return 0
    fi
}

touch-done () {
    done_dir="$BASE_DIR/var/run/done"
    func="${FUNCNAME[1]}"
    touch "$done_dir/$func"
}

# configuration steps
clone-etc () {
    check-done || return 0
    xcode-select --install 2>/dev/null || true

    mkdir -p "$BASE_DIR/share/github"

    while true
    do
        has_git=$(git --version 2>/dev/null || echo "false")
        if [ "$has_git" != "false" ]
        then
            break
        fi
        echo "sleeping"
        sleep 5
    done

    git clone https://github.com/xiaket/etc.git "$BASE_DIR/share/github/etc"
    ln -s "$BASE_DIR/share/github/etc" "$BASE_DIR/etc"
    touch-done
}

homebrew () {
    check-done || return 0
    bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    touch-done
}

homebrew-packages () {
    check-done || return 0
    homebrew

    # system utils
    # development tools
    # utils
    brew install \
        bash bash-completion coreutils findutils gawk gcc gnu-sed gnu-tar gnu-time gnutls openssl procmail readline tree wget \
        colordiff ffmpeg fzf git git-delta git-lfs go jq podman python3 ripgrep rust rustfmt shellcheck shfmt sqlite stylua tig \
        atuin mtr mpv neovim p7zip youtube-dl zoxide

    touch-done
}

homebrew-casks () {
    check-done || return 0
    homebrew

    brew install bitwarden homebrew/cask/dash drawio firefox hammerspoon iina itsycal kitty obsidian raycast
    # brew install slack zoom
    brew install font-fira-code-nerd-font
    touch-done
}

python-packages () {
    check-done || return 0
    brew install pipx
    pipx install black icdiff neovim poetry ptpython pyflakes pygments Snape termcolor
    touch-done
}

write-defaults () {
    check-done || return 0

    # disable the dashboard
    defaults write com.apple.dashboard mcx-disabled -bool TRUE; killall Dock

    # be quiet please finder
    defaults write com.apple.finder FinderSounds -bool FALSE; killall Finder

    # disable delay when
    defaults write com.apple.dock autohide-fullscreen-delayed -bool FALSE; killall Dock

    # minimize key repeat
    defaults write -g InitialKeyRepeat -int 10
    defaults write -g KeyRepeat -int 1

    # Disable smarts, I don't need your help thanks.
    defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false
    defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
    defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false

    touch-done

    # Switch to previous tab using alt-a and next tab alt-s.
    defaults write com.apple.Safari NSUserKeyEquivalents '{
      "Show Previous Tab"="~a";
      "Show Next Tab"="~s";
      "Close Tab"="~q";
    }'
}

build-ps1 () {
    check-done || return 0
    $brewdir/bin/cargo build --release
    strip target/release/ps1
    mv target/release/ps1 ../bin
    touch-done
}

create-links () {
    check-done || return 0
    # for configuration in $HOME
    ln -sf "$BASE_DIR/etc/bashrc" "$HOME/.bashrc"
    ln -sf "$HOME/.bashrc" "$HOME/.bash_profile"
    ln -sf "$BASE_DIR/etc/gitconfig" "$HOME/.gitconfig"
    ln -sf "$BASE_DIR/etc/hammerspoon" "$HOME/.hammerspoon"
    ln -sf "$BASE_DIR/etc/inputrc" "$HOME/.inputrc"
    ln -sf "$BASE_DIR/etc/pythonrc" "$HOME/.pythonrc"
    ln -sf "$BASE_DIR/etc/snape.json" "$HOME/.snape.json"
    ln -sf "$BASE_DIR/etc/nvim" "$HOME/.vim"
    ln -sf "$BASE_DIR/share/github" "$HOME/.Github"
    ln -sf "$BASE_DIR/share/ssh" "$HOME/.ssh"

    # for configuration in .config
    mkdir -p "$HOME/.config"
    ln -sf "$BASE_DIR/etc/nvim" "$HOME/.config/nvim"
    ln -sf "$BASE_DIR/etc/kitty" "$HOME/.config/kitty"
    ln -sf $brewdir/bin/python3 $brewdir/bin/python
    ln -sf $brewdir/bin/pip3 $brewdir/bin/pip
    touch-done
}

misc-config () {
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
homebrew-casks
python-packages
build-ps1
create-links
misc-config
