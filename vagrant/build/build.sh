#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail


if [ ! -f ubuntu-22.04.3-live-server-amd64.iso ]
then
    wget 'https://releases.ubuntu.com/22.04.3/ubuntu-22.04.3-live-server-amd64.iso'
fi

if [ ! command -v packer &> /dev/null ]
then
  brew install packer
fi
packer plugins install github.com/hashicorp/qemu

# This step would run for around 20-30 mins on an M1 Max.
# Add PACKER_LOG=1 to debug.
# PACKER_LOG=1 packer build .
packer build .

vagrant box add ubuntu-2204 ubuntu-2204-x86_64.libvirt.box
