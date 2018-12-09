gm (){
  mod="$1"
  # goto module directory
  module_path=`python3 -c "import $mod;print($1.__file__.rsplit('/', 1)[0])" 2>/dev/null` || module_path=`python2 -c "import $mod;print($1.__file__.rsplit('/', 1)[0])"`
  cd $module_path
}

ls (){
  cwd=`pwd`
  OPTIONS="-lhtr"

  if [ "x$cwd" = "x$HOME" ]
  then
    OPTIONS="--hide='VirtualBox VMs' --hide=Applications --hide=Books --hide=Desktop --hide=Dropbox --hide=Library --hide=Music --hide=Movies --hide=Pictures --hide=Public --hide=Documents $OPTIONS"
  fi

  if [ "x$ARCH" = "xDarwin" ]
  then
    bin="/usr/local/bin/gls"
  else
    bin="/bin/ls"
  fi

  echo $OPTIONS | xargs "$bin" --color=always $*
}

mk () {
  if [ $# -eq 0 ]
  then
    eval "$MARKED"
  else
    export MARKED="$@"
    echo "command marked."
  fi
}

denv () {
  state=`docker-machine status default`
  if [ $state = "Stopped" ]
  then
    echo "starting docker-machine"
    docker-machine start default >/dev/null
  fi
  eval $(docker-machine env default)
}

ip138 () {
  curl "http://www.ip138.com/ips138.asp?ip=$1" 2>/dev/null | iconv -f gb18030 -t utf-8 | egrep "\"ul1" | sed "s/<[^>]*>/./g;s/^\s*//g; s/\.\././g;s/\.\././g" | python -c "import sys; print sys.stdin.read().replace('.', '\n')" | grep -v "^$"
}

dbash () {
  docker exec -it `docker ps | head -n 2 | tail -n 1 | awk '{print $1}'` bash
}
