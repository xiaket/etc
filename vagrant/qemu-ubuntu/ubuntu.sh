#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# This stage does not have any prerequisites. We should run this after the first boot.
HOME=/home/vagrant
BASE_DIR="$HOME/.xiaket"
USER=vagrant


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

linux-packages () {
    check-done || return 0
    apt install -y golang pkgconf make docker.io neovim python3-pip python3-venv python3-dev zoxide mysql-client rustc cargo openssl libssl-dev
    touch-done
}

linux-config () {
    check-done || return 0
    usermod -G docker "$USER"
    touch-done
}

python-packages () {
    check-done || return 0
    sudo -u "$USER" python3 -m pip install -U pip
    sudo -u "$USER" python3 -m pip install black icdiff poetry psutil ptpython pyflakes pygments requests sh Snape termcolor virtualenv
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
    ln -sf "$BASE_DIR/etc/inputrc" "$HOME/.inputrc"
    ln -sf "$BASE_DIR/etc/pythonrc" "$HOME/.pythonrc"
    ln -sf "$BASE_DIR/etc/ptpython" "$HOME/.ptpython"

    # for configuration in .config
    mkdir -p "$HOME/.config"
    chown -R "$USER":"$USER" "$HOME/.xiaket" "$HOME/.bashrc" "$HOME/.pythonrc" "$HOME/.ptpython" "$HOME/.inputrc" "$HOME/.config"
    touch-done
}


clone-etc
linux-packages
linux-config
python-packages
build-ps1
create-links
