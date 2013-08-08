#!/bin/sh
#
# Author:         Xia Kai <xiaket@corp.netease.com/xiaket@gmail.com>
# Filename:       cleanssh.sh
# Date created:   2013-08-07 14:53
# Last modified:  2013-08-08 16:12
#
# Description:
#

FILE=~/.ssh/known_hosts
TEMPFILE=`mktemp /tmp/clean_ssh.XXXXXX || exit 1`

for host in `awk '{print $1}' $FILE | sed "s/\[//g;s/\]//g;s/,/ /g" | awk '{print $1}' | sed "s/:32200//g"`
do
    output=`ssh -o ConnectTimeout=3 -o ConnectionAttempts=1 $host "touch ~/.hushlogin" 2>&1`

    bad=0
    echo $output | grep "timed out" >/dev/null
    if [ $? -eq 0 ]
    then
        echo "timed out: $host." >> $TEMPFILE
        bad=1
        retouch=0
    fi

    echo $output | grep "Could not resolve" >/dev/null
    if [ $? -eq 0 ]
    then
        echo "obseleted shortcut: $host." >> $TEMPFILE
        bad=1
        retouch=0
    fi

    echo $output | grep "Permission denied" >/dev/null
    if [ $? -eq 0 ]
    then
        echo "permission denied: $host." >> $TEMPFILE
        bad=1
        retouch=0
    fi

    echo $output | grep "WARNING" >/dev/null
    if [ $? -eq 0 ]
    then
        echo "key changed: $host." >> $TEMPFILE
        bad=1
        retouch=1
    fi

    if [ $bad -eq 1 ]
    then
        echo "removing $host from known_hosts file." >> $TEMPFILE
        grep -v "$host" $FILE > /tmp/cleanssh.out && mv /tmp/cleanssh.out $FILE
        if [ $retouch -eq 1 ]
        then
            ssh $host "touch ~/.hushlogin" 2>&1 >/dev/null
        fi
    fi
done

cat $TEMPFILE | mail -s "clean ssh" xiaket@corp.netease.com

rm -f $TEMPFILE
