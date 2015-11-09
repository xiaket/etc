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
