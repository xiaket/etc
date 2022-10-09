#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# This stage does not have any prerequisites. We should run this after the first boot.
BASE_DIR="$HOME/.xiaket"


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

    mkdir -p "$BASE_DIR/share/github"

    git clone https://github.com/xiaket/etc.git "$BASE_DIR/share/github/etc"
    ln -s "$BASE_DIR/share/github/etc" "$BASE_DIR/etc"
    touch-done
}

packages () {
    check-done || return 0

    touch-done
}

python-packages () {
    check-done || return 0
    python3 -m pip install -U pip
    python3 -m pip install black icdiff neovim poetry ptpython pyflakes pygments requests sh Snape termcolor virtualenv
    touch-done
}

build-ps1 () {
    check-done || return 0
    cd "$BASE_DIR/etc/ps1"
    cargo build --release
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
    rm -rf "$HOME/.config/nvim" "$HOME/.config/kitty" "$HOME/.config/autostart"
    ln -sf "$BASE_DIR/etc/nvim" "$HOME/.config/nvim"
    ln -sf "$BASE_DIR/etc/kitty" "$HOME/.config/kitty"
    ln -sf "$BASE_DIR/etc/linux/autostart" "$HOME/.config/autostart"
    touch-done
}

misc-config () {
    check-done || return 0
    chsh -s /bin/bash
    nvim --headless -c 'autocmd User PackerComplete quitall' -c 'PackerSync'
    (cd "$BASE_DIR/etc" && git remote set-url origin git@github.com:xiaket/etc.git)
    touch-done
}

clone-etc
packages
python-packages
build-ps1
create-links
misc-config
