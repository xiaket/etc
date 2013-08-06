#!/bin/sh
#
# Author:         Xia Kai <xiaket@corp.netease.com/xiaket@gmail.com>
# Filename:       online.sh
# Last modified:  2013-07-17 10:15
#
# Description:
#
#!/bin/bash

HG="/usr/local/bin/hg"
# clean up
rm -rf /tmp/online

# download archive and clean it.
scp online:~/online.tgz /tmp/online.tgz >/dev/null
cd /tmp && tar xfz online.tgz
rm -f online.tgz
cd /tmp/online
find . -name *.pyc | xargs rm


# mv content to hg dir.
rm -r ~/.Hg/online
mv /tmp/online ~/.Hg/online

# mail output.
cd ~/.Hg/online/
$HG status > /tmp/online/output

if [ -s /tmp/online/output ]
then
    output=`$HG status`
    ~/.xiaket/bin/mailer $HG "hg:online" "$output"
fi
