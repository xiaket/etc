function debian(){
    vboxmanage list runningvms | grep -q "Debian 8"
    if [ $? -eq 0 ]
    then
        /bin/echo -n "Running, stop it?(y/n): "
        read choice
        if [ "x$choice" = "xy" ]
        then
            supervisorctl -c ~/.supervisord.conf stop "debian"
        fi
    else
        supervisorctl -c ~/.supervisord.conf start "debian"
    fi
}

function docker(){
    vboxmanage list runningvms | grep -q "docker"
    if [ $? -eq 0 ]
    then
        /bin/echo -n "Running, stop it?(y/n): "
        read choice
        if [ "x$choice" = "xy" ]
        then
            supervisorctl -c ~/.supervisord.conf stop "docker"
        fi
    else
        supervisorctl -c ~/.supervisord.conf start "docker"
    fi
}

function cbc(){
    vboxmanage list runningvms | grep -q "admin"
    if [ $? -eq 0 ]
    then
        /bin/echo -n "Running, stop it?(y/n): "
        read choice
        if [ "x$choice" = "xy" ]
        then
            supervisorctl -c ~/.supervisord.conf stop "cbcadmin"
            supervisorctl -c ~/.supervisord.conf stop "cbcgs"
        fi
    else
        supervisorctl -c ~/.supervisord.conf start "cbcadmin"
        supervisorctl -c ~/.supervisord.conf start "cbcgs"
    fi
}

function cbcadm(){
    vboxmanage list runningvms | grep -q "cbcadmin"
    if [ $? -eq 0 ]
    then
        /bin/echo -n "Running, stop it?(y/n): "
        read choice
        if [ "x$choice" = "xy" ]
        then
            supervisorctl -c ~/.supervisord.conf stop "cbcadmin"
        fi
    else
        supervisorctl -c ~/.supervisord.conf start "cbcadmin"
    fi
}

function nightwatch(){
    cd ~/.GIT/Python/nightwatch
}

function cbrc(){
    cd ~/.GIT/Python/cbrc-mods
}
function hooks(){
    cd ~/.GIT/Gitlab/server-hooks
}
function xycmd(){
    cd ~/.GIT/Python/xycmd/xycmd
}
function xyteam(){
    cd ~/.GIT/Python/pyteam/xyteam
}
