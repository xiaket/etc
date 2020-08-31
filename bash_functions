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

ip138 () {
  curl "http://www.ip138.com/ips138.asp?ip=$1" 2>/dev/null | iconv -f gb18030 -t utf-8 | egrep "\"ul1" | sed "s/<[^>]*>/./g;s/^\s*//g; s/\.\././g;s/\.\././g" | python -c "import sys; print sys.stdin.read().replace('.', '\n')" | grep -v "^$"
}

gc () {
  if git config remote.origin.url | grep -q github.com
  then
      git commit -vs --author "Kai Xia <kaix+github@fastmail.com>" "$@"
  else
      git commit -v --author "Kai Xia <${ALT_GIT_EMAIL}>" "$@"
  fi
}

vm() {
  # toggle vi edit mode in bash.
  current_mode=$(bind -v | awk '/keymap/ {print $NF}')
  if [ "$current_mode" = "emacs" ]
  then
    set -o vi
  else
    set -o emacs
  fi
}
