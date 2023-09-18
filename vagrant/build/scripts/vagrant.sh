#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

# set a default HOME_DIR environment variable if not set
HOME_DIR="${HOME_DIR:-/home/vagrant}";

pubkey_url="https://raw.githubusercontent.com/hashicorp/vagrant/main/keys/vagrant.pub";
mkdir -p "$HOME_DIR"/.ssh;
apt-get install -y wget
wget --no-check-certificate "$pubkey_url" -O "$HOME_DIR"/.ssh/authorized_keys;

chown -R vagrant "$HOME_DIR"/.ssh;
chmod -R go-rwsx "$HOME_DIR"/.ssh;
