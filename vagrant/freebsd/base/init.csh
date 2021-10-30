setenv FREEBSD_MIRROR http://mirror.aarnet.edu.au/pub/FreeBSD
setenv username vagrant
setenv ASSUME_ALWAYS_YES "yes"

dhclient em0
mkdir -p /usr/local/etc/pkg/repos/
echo 'FreeBSD: {\
  url: "pkg+http://pkg0.pkt.FreeBSD.org/${ABI}/latest",\
  mirror_type: "srv",\
  signature_type: "fingerprints",\
  fingerprints: "/usr/share/keys/pkg",\
  enabled: yes\
}' > /usr/local/etc/pkg/repos/freebsd.conf
pkg install pkg ca_root_nss sudo bash virtualbox-ose-additions

mkdir -p "/usr/local/etc/sudoers.d"
echo "#includedir /usr/local/etc/sudoers.d" > "/usr/local/etc/sudoers"
chmod 440 "/usr/local/etc/sudoers"
echo "%$username ALL=(ALL) NOPASSWD: ALL" > "/usr/local/etc/sudoers.d/$username"
chmod 440 "/usr/local/etc/sudoers.d/$username"

pw groupadd -n "$username" -g 1001
echo "*" | pw useradd -n "$username" -u 1001 -s /usr/local/bin/bash -m -g 1001 -G wheel -H 0
mkdir -p "/home/${username}/.ssh/"
fetch -o "/home/${username}/.ssh/authorized_keys" https://raw.github.com/mitchellh/vagrant/master/keys/vagrant.pub
echo 'sshd_enable="YES"' >> "/etc/rc.conf"
echo 'ifconfig_em0="DHCP"' >> "/etc/rc.conf"
echo 'vboxguest_enable="YES"' >> "/etc/rc.conf"
echo 'vboxservice_enable="YES"' >> "/etc/rc.conf"

poweroff
