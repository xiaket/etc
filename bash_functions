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

#function gc(){
    # psedo-code:
# for file in $?
# do
# check if file is added.
# if not, add
# done
    #git commit -vs
#}

function denv(){
    if VBoxManage list vms | grep -q '"docker"' && docker-machine ls | grep -q "^docker"
    then
        echo "found existing docker env, configuring it."
    else
        echo "docker env not found, recreate it?(y/n)"
        read choice
        if [ "x$choice" = "xy" ]
        then
            docker-machine rm docker
            rm -rf ~/.docker/machine/machines/docker
            docker-machine create --driver virtualbox docker
        fi
        echo "docker env created, configuring it."
    fi
    eval "$(docker-machine env docker)"
    echo "ready to go!"
}
