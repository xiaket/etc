#!/bin/sh
#
# Author:         Xia Kai <xiaket@corp.netease.com/xiaket@gmail.com>
# Filename:       update_repo.sh
# Date created:   2013-08-04 12:15
# Last modified:  2013-08-05 13:38
#
# Description:
#

GIT_DIRS="/Users/xiaket/.xiaket/share/repos/pub-repos/github"
SVN_DIRS="/Users/xiaket/.xiaket/share/repos/pub-repos/github"
HG_DIRS="/Users/xiaket/.xiaket/share/repos/pub-repos/code.google.hg"
NTES_DIRS="/Users/xiaket/.NTES"
TEMPFILE=`mktemp /tmp/cron_update.XXXXXX || exit 1`

# update Homebrew
echo "updating homebrew" >> $TEMPFILE
/usr/local/bin/brew update 2>&1 >> $TEMPFILE

# update public git repos
echo "updating github repos" >> $TEMPFILE
for dir in $GIT_DIRS
do
    cd "$dir"
    for repo in `find . -name ".git" | sed "s/\/\.git//g"`
    do
        echo "updating ${dir}/${repo}" >> $TEMPFILE
        cd "$repo"
        git reset --hard HEAD 2>&1 >> $TEMPFILE
        git clean -f 2>&1 >> $TEMPFILE
        git pull 2>&1 >> $TEMPFILE
        cd - >/dev/null
    done
done

# update ntes svn repos
echo "updating ntes repos" >> $TEMPFILE
for dir in $NTES_DIRS
do
    cd "$dir"
    for repo in `find . -name ".svn" | sed "s/\/\.svn//g"`
    do
        echo "updating ${dir}/${repo}" >> $TEMPFILE
        cd "$repo"
        svn up --config-option servers:global:http-timeout=5 2>&1 >> $TEMPFILE
        cd - >/dev/null
    done
done

# update public hg repos
echo "updating ntes repos" >> $TEMPFILE
for dir in $NTES_DIRS
do
    cd "$dir"
    for repo in `find . -name ".hg" | sed "s/\/\.hg//g"`
    do
        echo "updating ${dir}/${repo}" >> $TEMPFILE
        cd "$repo"
        hg pull >> $TEMPFILE
        cd - >/dev/null
    done
done

cat $TEMPFILE
rm -f $TEMPFILE
