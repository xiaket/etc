gm() {
	mod="$1"
	# goto module directory
	module_path=$(python3 -c "import $mod;print($1.__file__.rsplit('/', 1)[0])" 2>/dev/null)
	cd $module_path
}

ls() {
	cwd=$(pwd)
	OPTIONS="-lhtr"

	if [ "x$cwd" = "x$HOME" ]; then
		OPTIONS="--hide='VirtualBox VMs' --hide=Applications --hide=Books --hide=Desktop --hide=Dropbox --hide=Library --hide=Music --hide=Movies --hide=Pictures --hide=Public --hide=Documents $OPTIONS"
	fi

	if [ "x$ARCH" = "xDarwin" ]; then
		bin="gls"
	else
		bin="/bin/ls"
	fi

	echo $OPTIONS | xargs "$bin" --color=always $*
}

mk() {
	if [ $# -eq 0 ]; then
		eval "$MARKED"
	else
		export MARKED="$@"
		echo "command marked."
	fi
}

ip138() {
	curl "http://www.ip138.com/ips138.asp?ip=$1" 2>/dev/null | iconv -f gb18030 -t utf-8 | egrep "\"ul1" | sed "s/<[^>]*>/./g;s/^\s*//g; s/\.\././g;s/\.\././g" | python -c "import sys; print sys.stdin.read().replace('.', '\n')" | grep -v "^$"
}

gc() {
	if git config remote.origin.url | grep -q github.com; then
		git commit -vs --author "Kai Xia <kaix+github@fastmail.com>" "$@"
	else
		git commit -v --author "Kai Xia <${ALT_GIT_EMAIL}>" "$@"
	fi
}

vm() {
	# toggle vi edit mode in bash.
	current_mode=$(bind -v | awk '/keymap/ {print $NF}')
	if [ "$current_mode" = "emacs" ]; then
		set -o vi
	else
		set -o emacs
	fi
}

aws-extract() {
	# export values in ~/.aws/credentials
	while IFS= read -r line; do
		name=$(echo "$line" | awk '{print $1}' | tr '[:lower:]' '[:upper:]')
		value=$(echo "$line" | awk '{print $3}')
		eval "export $name=\"$value\""
	done < <(cat ~/.aws/credentials | grep -A 3 "\[default\]" | tail -n 3)
}

cat-dir() {
  local dir="$1"

  # Use current working directory if no directory is provided
  if [[ -z "$dir" ]]; then
    dir=$(pwd)
  fi

  if [[ ! -d "$dir" ]]; then
    echo "Error: '$dir' is not a valid directory."
    return 1
  fi

  # Find all files in the directory and print each file with its name
  find "$dir" -type f | while read -r file; do
    echo "File: $(basename "$file")"
    cat "$file"
    echo "--------------------"
  done
}

cat-files() {
  # Check if at least one filename is provided
  if [[ $# -eq 0 ]]; then
    echo "Error: No files provided."
    return 1
  fi

  # Iterate over each provided filename
  for file in "$@"; do
    # Check if the file exists and is a regular file
    if [[ -f "$file" ]]; then
      echo "File: $(basename "$file")"
      cat "$file"
      echo "--------------------"
    else
      echo "Error: '$file' is not a valid file."
    fi
  done
}

cd () {
  if [ "$#" = 0 ]
  then
    builtin cd
    return
  fi

  # bookmarked dirs.
  case "$1" in
    "=e")
      builtin cd ~/.xiaket/etc
      return
      ;;
    "=g")
      builtin cd "$(git rev-parse --show-toplevel)"
      return
      ;;
  esac

  # dest is a file, go to its dir
  if [[ -f "$1" ]]
  then
    dir_name="$(dirname $1)"
    builtin cd "$dir_name"
    return
  fi

  if [[ -d "$1" ]] || [[ $1 == */* ]] || [[ $1 == "-" ]]
  then
    # default cd behavior
    builtin cd "$1"
    return
  fi

  found=$(find . -name "$1" -type d)
  # Check if the output is empty
  if [ -z "$found" ]; then
    matches=0
  else
    matches=$(echo "$found" | grep -c '^')
  fi

  if [ "$matches" = "0" ]
  then
    # fallback to default cd behavior, but this would probably fail
    builtin cd "$@"
  elif [ "$matches" = "1" ]
  then
    builtin cd "$found"
  else
    echo -e "found $matches dirs:\n\n$found"
  fi
}
