#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

vm_name="freebsd-base"
box_name="xiaket/freebsd-base"
iso=/tmp/mfsbsd.iso

if [ ! -f "$iso" ]; then
	wget https://mfsbsd.vx.sk/files/iso/13/amd64/mfsbsd-se-13.0-RELEASE-amd64.iso -O "$iso"
fi

has_box=$(vagrant box list | grep -c "$box_name" || true)

if [ "$has_box" = "1" ]; then
	vagrant box remove "$box_name"
fi

rm -f package.box

VBoxManage createvm --name "${vm_name}" --ostype FreeBSD_64 --basefolder build --register
VBoxManage modifyvm "${vm_name}" --cpus 2
VBoxManage modifyvm "${vm_name}" --memory 6144
VBoxManage modifyvm "${vm_name}" --vram 64
VBoxManage modifyvm "${vm_name}" --graphicscontroller vmsvga
VBoxManage modifyvm "${vm_name}" --audio none
VBoxManage modifyvm "${vm_name}" --hwvirtex on
VBoxManage storagectl "${vm_name}" --name IDE --add ide
VBoxManage createmedium disk --filename zfs.vmdk --size 60000 --format vmdk
VBoxManage storageattach "${vm_name}" --storagectl IDE --port 0 --device 0 --type hdd --medium zfs.vmdk
VBoxManage storageattach "${vm_name}" --storagectl IDE --port 0 --device 1 --type dvddrive --medium "$iso"
VBoxManage startvm "${vm_name}" --type gui
sleep 2
# Enter to skip the 10 seconds wait
VBoxManage controlvm "${vm_name}" keyboardputscancode e0 1c
sleep 45
VBoxManage controlvm "${vm_name}" keyboardputfile mfs.credential
sleep 1
VBoxManage controlvm "${vm_name}" keyboardputfile zfs.csh

wait-till-poweroff() {
	while true; do
		state=$(VBoxManage showvminfo "${vm_name}" --machinereadable | grep "VMState=" | sed "s/\"/ /g" | awk '{print $2}')
		if [ "$state" == "poweroff" ]; then
			break
		fi
		sleep 10
		echo "Sleeping"
	done
}

wait-till-poweroff
VBoxManage storageattach "${vm_name}" --storagectl IDE --port 0 --device 1 --type dvddrive --medium none
sleep 1

# Start the machine a second to use zfs and install stuff.
VBoxManage startvm "${vm_name}" --type gui
sleep 2
# Enter to skip the 10 seconds wait
VBoxManage controlvm "${vm_name}" keyboardputscancode e0 1c
sleep 45
VBoxManage controlvm "${vm_name}" keyboardputfile mfs.credential
sleep 1
VBoxManage controlvm "${vm_name}" keyboardputfile init.csh

wait-till-poweroff
# create package.
vagrant package --base "${vm_name}"
vagrant box add "${box_name}" file://./package.box
VBoxManage unregistervm "${vm_name}" --delete
