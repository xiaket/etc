gm (){
  # goto module directory
  module_path=`python -c "import $1;print($1.__file__.rsplit('/', 1)[0])"`
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
