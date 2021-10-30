mkdir -p /cdrom
mount_cd9660 /dev/cd0 /cdrom
zfsinstall -d /dev/ada0 -u /cdrom/13.0-RELEASE-amd64 -p zroot -s 1G
poweroff
