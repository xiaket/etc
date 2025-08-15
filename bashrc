##############
# The basics #
##############
[ -z "${PS1:-}" ] && return
umask 0022

# Global settings.

# Prepend cd to directory names automatically
shopt -s autocd 2> /dev/null

# Autocorrect typos in path names when using `cd`
shopt -s cdspell

# explicitly enable term colors.
export TERM="xterm-256color"
ARCH=$(uname -s)

if [ "$ARCH" = "Linux" ]; then
  export MAN_POSIXLY_CORRECT=1
  COLORS=dircolors
  # setup key repeat
  xset r rate 180 80
else
  # running on a macOS machine.
  COLORS=gdircolors
fi

if [ "$(uname -m)" = "arm64" ]; then
  brewdir="/opt/homebrew"
else
  brewdir="/usr/local"
fi

xiaketDIR=~/.xiaket
etcdir=$xiaketDIR"/etc"
altdir=$xiaketDIR"/alt"

# PATH ordering policy: Alt dir things > My own script > Homebrew > System, bin > sbin
export PATH="$altdir/bin:${HOME}/.xiaket/etc/bin:${HOME}/.xiaket/go/bin:$brewdir/bin:$brewdir/opt/ruby/bin:$brewdir/sbin:/usr/local/bin:/bin:/usr/bin:/usr/sbin:/sbin:${HOME}/.cargo/bin:$brewdir/opt/coreutils/bin:$brewdir/opt/fzf/bin:$HOME/.rye/shims:${HOME}/Library/Python/3.11/bin:${HOME}/.local/bin:${HOME}/.claude/local"
export MANPATH="/usr/local/opt/coreutils/libexec/gnuman:$MANPATH"
export LANG=en_US.UTF-8
# Fix Chinese translation in bash
export LANGUAGE="en_US"
export DYLD_FALLBACK_LIBRARY_PATH=/usr/local/opt/openssl/lib
export XDG_CONFIG_HOME="$etcdir"

############
# sourcing #
#############

# For things that can be used as alias
. "$etcdir"/alias

# For things that can only be done as a bash function.
if [ -f "$etcdir"/bash_functions ]; then
  . "$etcdir"/bash_functions
fi

# For Alternative settings
if [ -f "$altdir/etc/bashrc" ]; then
  . "$altdir/etc/bashrc"
fi

# for fzf
#set rtp+=/usr/local/opt/fzf
#[ -f $etcdir/fzf/key-binding.sh ] && source $etcdir/fzf/key-binding.sh

# For bash completion.
. "$etcdir"/bash_completion

# I love my prompt
function _xiaket_prompt {
  status=$?
  PS1="$(ps1 $status)"
  history -a
  history -n
}

export PROMPT_COMMAND='_xiaket_prompt'

################
# bash history #
################

# don't put duplicate lines in the history. See bash(1) for more options
#export HISTCONTROL=ignoredups
# unlimited playback.
#export HISTFILESIZE=99999
#export HISTSIZE=99999
#export HISTTIMEFORMAT="%h/%d - %H:%M:%S "
# append to the history file, don't overwrite it
#shopt -s histappend

#########################
# environment variables #
#########################

export PYTHONSTARTUP=~/.pythonrc
export PYTHONDONTWRITEBYTECODE="False"
export GOPATH="${xiaketDIR}/go"

# user nvim for everything
export GIT_EDITOR=nvim
export VISUAL=nvim
export EDITOR=nvim

#################
# accessibility #
#################
eval "$("$COLORS" "$HOME/.xiaket/etc/dir_colors")"

# Don’t clear the screen after quitting a manual page.
export MANPAGER='less -X'

# check the window size after each command and, if necessary,
# update the values of LINES and COLUMNS.
shopt -s checkwinsize

###########################
# bash history via atuin #
###########################
source "$etcdir/bash-preexec.sh"

ATUIN_SESSION=$(atuin uuid)
export ATUIN_SESSION

_atuin_preexec() {
  local id
  id=$(atuin history start -- "$1")
  export ATUIN_HISTORY_ID="${id}"
}

_atuin_precmd() {
  local EXIT="$?"

  [[ -z "${ATUIN_HISTORY_ID}" ]] && return

  (ATUIN_LOG=error atuin history end --exit "${EXIT}" -- "${ATUIN_HISTORY_ID}" &) > /dev/null 2>&1
  export ATUIN_HISTORY_ID=""
}

__atuin_history() {
  # shellcheck disable=SC2048,SC2086
  HISTORY="$(ATUIN_SHELL_BASH=t ATUIN_LOG=error atuin search $* -i -- "${READLINE_LINE}" 3>&1 1>&2 2>&3)"

  if [[ $HISTORY == __atuin_accept__:* ]]; then
    HISTORY=${HISTORY#__atuin_accept__:}
    echo "$HISTORY"
    # Need to run the pre/post exec functions manually
    _atuin_preexec "$HISTORY"
    eval "$HISTORY"
    _atuin_precmd
    echo
    READLINE_LINE=""
    READLINE_POINT=${#READLINE_LINE}
  else
    READLINE_LINE=${HISTORY}
    READLINE_POINT=${#READLINE_LINE}
  fi

}

if [[ -n "${BLE_VERSION-}" ]]; then
  blehook PRECMD-+=_atuin_precmd
  blehook PREEXEC-+=_atuin_preexec
else
  precmd_functions+=(_atuin_precmd)
  preexec_functions+=(_atuin_preexec)
fi

bind -x '"\C-r": __atuin_history'
bind -x '"\e[A": __atuin_history --shell-up-key-binding'
bind -x '"\eOA": __atuin_history --shell-up-key-binding'

#####################
# ssh agent forward #
#####################
if ls -l ~/.ssh/*.priv > /dev/null 2>&1; then
  SSH_ENV="$HOME/.ssh/environment"

  function start_agent {
    content=$(/usr/bin/ssh-agent | sed "/^echo/d")
    [ -f "$SSH_ENV" ] && return 0 || echo "$content" > "$SSH_ENV"
    chmod 600 "${SSH_ENV}"
    . "${SSH_ENV}" > /dev/null
    /usr/bin/ssh-add ~/.ssh/*.priv
  }

  # Define a lock file
  LOCKFILE=~/.xiaket/var/tmp/ssh.lock

  # Create the directory if it doesn't exist
  [ -d ~/.xiaket/var/tmp ] || mkdir -p ~/.xiaket/var/tmp

  # Use flock for locking
  exec 200> "$LOCKFILE"
  flock -n 200 || exit 1
  trap 'rm -f "$LOCKFILE"; exit $?' INT TERM EXIT

  if [ -f "${SSH_ENV}" ]; then
    . "${SSH_ENV}" > /dev/null
    if ! pgrep -q "ssh-agent$"; then
      rm -f "${SSH_ENV}"
      start_agent
    fi
  else
    start_agent
  fi

  # Remove lock file
  rm -f "$LOCKFILE"
  trap - INT TERM EXIT
fi
