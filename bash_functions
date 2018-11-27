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

mark () {
  if [ $# -eq 0 ]
  then
    eval "$MARKED"
  else
    export MARKED="$@"
    echo "command marked."
  fi
}
