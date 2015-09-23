function debian(){
    vboxmanage list runningvms | grep -q "Debian 8"
    if [ $? -eq 0 ]
    then
        /bin/echo -n "Running, stop it?(y/n): "
        read choice
        if [ $choice = "y" ]
        then
            echo "stop"
            #supervisorctl -c ~/.supervisord.conf stop "debian"
        fi
    else
        echo "start"
        #supervisorctl -c ~/.supervisord.conf start "debian"
    fi
}
