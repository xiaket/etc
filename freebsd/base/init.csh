# run zfsinstall

# use australian mirror to speed up things.
setenv FREEBSD_MIRROR http://mirror.aarnet.edu.au/pub/FreeBSD
# zfsinstall mount the new fs to /mnt. Further configuration should go to this dir.
setenv dstdir /mnt
zfsinstall -d /dev/ada0

# vagrant
setenv username vagrant

setenv ASSUME_ALWAYS_YES "yes"

# install a few essential packages to the target dir.
mkdir -p /usr/local/etc/pkg/repos/
echo 'FreeBSD: {\
  url: "pkg+http://pkg0.pkt.FreeBSD.org/${ABI}/latest",\
  mirror_type: "srv",\
  signature_type: "fingerprints",\
  fingerprints: "/usr/share/keys/pkg",\
  enabled: yes\
}' > /usr/local/etc/pkg/repos/freebsd.conf
pkg -r "${dstdir}" install pkg ca_root_nss sudo bash virtualbox-ose-additions

# configure sudo
mkdir -p "${dstdir}/usr/local/etc/sudoers.d"
echo "#includedir /usr/local/etc/sudoers.d" > "${dstdir}/usr/local/etc/sudoers"
chmod 440 "${dstdir}/usr/local/etc/sudoers"
echo "%$username ALL=(ALL) NOPASSWD: ALL" > "${dstdir}/usr/local/etc/sudoers.d/$username"
chmod 440 "${dstdir}/usr/local/etc/sudoers.d/$username"

# add vagrant user
pw -R "${dstdir}" groupadd -n $username -g 1001
echo "*" | pw -R "${dstdir}" useradd -n $username -u 1001 -s /usr/local/bin/bash -m -g 1001 -G wheel -H 0

# setup key for vagrant user
mkdir -p "${dstdir}/home/${username}/.ssh/"
fetch -o "${dstdir}/home/${username}/.ssh/authorized_keys" https://raw.github.com/mitchellh/vagrant/master/keys/vagrant.pub

# services
echo 'sshd_enable="YES"' >> "${dstdir}/etc/rc.conf"
echo 'ifconfig_em0="DHCP"' >> "${dstdir}/etc/rc.conf"
echo 'vboxguest_enable="YES"' >> "${dstdir}/etc/rc.conf"
echo 'vboxservice_enable="YES"' >> "${dstdir}/etc/rc.conf"

# use pkt as mirror.
mkdir -p "${dstdir}/usr/local/etc/pkg/repos/"
echo 'FreeBSD: {\
  url: "pkg+http://pkg0.pkt.FreeBSD.org/${ABI}/latest",\
  mirror_type: "srv",\
  signature_type: "fingerprints",\
  fingerprints: "/usr/share/keys/pkg",\
  enabled: yes\
}' > "${dstdir}/usr/local/etc/pkg/repos/freebsd.conf"

init 0
