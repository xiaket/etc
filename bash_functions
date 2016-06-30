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

function gc(){
    new_files=`git status --short | grep '^??' | awk '{print $NF}' | sed "s/\n/ /g"`
    added_files=""
    if [ ! -z "$new_files" ]
    then
        echo "Adding new files: $new_files"
        for file in `git status --short | grep '^??' | awk '{print $NF}'`
        do
            /bin/echo -n "Adding $file , sure?(y/n): "
            read choice
            if [ "x$choice" = "xy" ]
            then
                git add "$file"
                added_files="$added_files $file"
            fi
        done
    fi
    git commit -vs $@ $added_files
}

function denv(){
    if vboxmanage list runningvms | grep -q '^"docker"'
    then
        echo "docker vm running."
    else
        VBoxManage startvm --type headless docker
    fi

    dm_status=`docker-machine ls | grep "^docker" | awk '{print $4}'`
    if [ "x$dm_status" = "xRunning" ]
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

function dls(){
    if [ -z $DOCKER_HOST ]
    then
        echo "Please do denv first."
        return
    fi
    echo "docker ps -a"
    echo -e "------------\n"
    docker ps -a
    echo ""
    echo "docker images"
    echo -e "-------------\n"
    docker images
}

function gogs(){
    if [ -z $DOCKER_HOST ]
    then
        echo "Please do denv first."
        return
    fi
    gogs_running=`docker inspect gogs | grep Status | grep -o running`
    if [ "${gogs_running}" = "running" ]
    then
        echo -e "gogs running, stop it?(y/n) "
        read choice
        if [ "x$choice" = "xy" ]
        then
            docker stop gogs 2>&1 > /dev/null
        fi
    else
        docker start gogs 2>&1 > /dev/null
    fi
}
