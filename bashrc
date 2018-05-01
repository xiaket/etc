##############
# The basics #
##############
[ -z "$PS1" ] && return
umask 0022

# Global settings.

# Prepend cd to directory names automatically
shopt -s autocd 2> /dev/null

# Autocorrect typos in path names when using `cd`
shopt -s cdspell

# explicitly enable term colors.
export TERM="xterm-256color"

if [ "x`uname -s`" = "xLinux" ]
then
    export MAN_POSIXLY_CORRECT=1

    # running on a linux virtual machine.
    COLORS=dircolors
    SED=sed
    ADD_KEY="yes"
    HAS_ITERM="no"
    COMPLETION_PATH=/etc/profile.d/bash_completion.sh
    YELLOW=$(tput setaf 136)
    ORANGE=$(tput setaf 166)
    RED=$(tput setaf 160)
    MAGENTA=$(tput setaf 125)
    VIOLET=$(tput setaf 61)
    BLUE=$(tput setaf 33)
    CYAN=$(tput setaf 37)
    GREEN=$(tput setaf 64)
    RESET=$(tput sgr0)
else
    # running on a macOS machine.
    COLORS=gdircolors
    SED=gsed
    ADD_KEY="yes"
    HAS_ITERM="yes"
    COMPLETION_PATH=/usr/local/etc/bash_completion
    YELLOW="\[$(tput setaf 136)\]"
    ORANGE="\[$(tput setaf 166)\]"
    RED="\[$(tput setaf 160)\]"
    MAGENTA="\[$(tput setaf 125)\]"
    VIOLET="\[$(tput setaf 61)\]"
    BLUE="\[$(tput setaf 33)\]"
    CYAN="\[$(tput setaf 37)\]"
    GREEN="\[$(tput setaf 64)\]"
    CRIMSON="\[$(tput setaf 124)\]"
    LIME="\[$(tput setaf 34)\]"
    WHITE="\[$(tput setaf 15)\]"
    RESET="\[$(tput sgr0)\]"
fi

xiaketDIR=~/.xiaket
etcdir=$xiaketDIR"/etc"
altdir=$xiaketDIR"/alt"

# PATH ordering policy: Alt dir things > My own script > Homebrew > System, bin > sbin
export PATH="$altdir/bin:~/.xiaket/etc/bin:~/.xiaket/go/bin:/usr/local/bin:/usr/local/sbin:/bin:/usr/bin:/sbin/usr/sbin:~/Library/Python/2.7/bin:/usr/local/opt/coreutils/bin"
export MANPATH="/usr/local/opt/coreutils/libexec/gnuman:$MANPATH"

############
# sourcing #
#############

# For things that can be used as alias
. "$etcdir"/alias

# For things that can only be done as a bash function.
if [ -f "$etcdir"/bash_functions ]
then
    . "$etcdir"/bash_functions
fi


_xiaket_prompt_git() {
  # copied from https://github.com/mathiasbynens/dotfiles/blob/master/.bash_prompt
  # I had tried to implement this in golang using goroutine but there's no
  # observable performance boost.
  if [ $(git rev-parse --is-inside-work-tree &>/dev/null; echo "${?}") != '0' ]; then
    return
  fi

  local s=''
  if [ "$(git rev-parse --is-inside-git-dir 2> /dev/null)" == 'false' ]; then
    # Ensure the index is up to date.
    git update-index --really-refresh -q &>/dev/null;

    # Check for uncommitted changes in the index.
    if ! $(git diff --quiet --ignore-submodules --cached); then
      s+='+'
    fi;

    # Check for unstaged changes.
    if ! $(git diff-files --quiet --ignore-submodules --); then
      s+='!'
    fi;

    # Check for untracked files.
    if [ -n "$(git ls-files --others --exclude-standard)" ]; then
      s+='?'
    fi;

    # Check for stashed files.
    if $(git rev-parse --verify refs/stash &>/dev/null); then
      s+='$'
    fi;

  fi;

  # Get the short symbolic ref.
  # If HEAD isn’t a symbolic ref, get the short SHA for the latest commit
  # Otherwise, just give up.
  branchName="$(git symbolic-ref --quiet --short HEAD 2> /dev/null || \
    git rev-parse --short HEAD 2> /dev/null || \
    echo '(unknown)')";

  [ -n "${s}" ] && s=" [${s}]";

  echo -e "${1}${branchName}${2}${s}";
}


function _xiaket_prompt {
  if [ $? -eq 0 ]
  then
    col=${LIME}
  else
    col=${CRIMSON}
  fi
  history -a; history -n;
  PS1="${col}[${BLUE}"$(mypwd ${WHITE})
  gitst=$(_xiaket_prompt_git ${ORANGE} ${YELLOW})
  [ -n "$gitst" ] && PS1+=" ${gitst}"
  if [ -n "${VIRTUAL_ENV}" ] && [[ "$PATH" == "${VIRTUAL_ENV}"* ]]
  then
    PS1="${ORANGE}^${RESET}${PS1}"
  fi
  PS1+="${col}]${RESET}"
}

export PROMPT_COMMAND='_xiaket_prompt'

# For bash completion.
. $COMPLETION_PATH

# If we are logging through tty, set locale to en_US.UTF-8
TTY=`tty | grep tty -c`
if [ $TTY == 1 ] || [ "x$OSTYPE" = "xlinux" ]
then
    export LANG=en_US.UTF-8
else
    export LANG=zh_CN.UTF-8
fi

# for fzf
set rtp+=/usr/local/opt/fzf
[ -f ~/.fzf.bash ] && source ~/.fzf.bash

################
# bash history #
################

# don't put duplicate lines in the history. See bash(1) for more options
export HISTCONTROL=ignoredups
# unlimited playback.
export HISTFILESIZE=99999
export HISTSIZE=99999
export HISTTIMEFORMAT="%h/%d - %H:%M:%S "
# append to the history file, don't overwrite it
shopt -s histappend

#########################
# environment variables #
#########################

# Setup Python PATH, so our python libraries would be portable.
export PYTHONPATH="$PYTHONPATH:${etcdir}/python/"
export PYTHONSTARTUP=~/.pythonrc
export PYTHONDONTWRITEBYTECODE="False"
export GOPATH="${xiaketDIR}/go"

# user nvim for everything
export SVN_EDITOR=nvim
export GIT_EDITOR=nvim
export VISUAL=nvim
export EDITOR=nvim

#################
# accessibility #
#################
export LS_OPTIONS='--color=always'
eval `"$COLORS" "$HOME/.xiaket/etc/dir_colors"`

# Don’t clear the screen after quitting a manual page.
export MANPAGER='less -X';

# check the window size after each command and, if necessary,
# update the values of LINES and COLUMNS.
shopt -s checkwinsize

#####################
# ssh agent forward #
#####################
SSH_ENV="$HOME/.ssh/environment"

function start_agent {
    content=`/usr/bin/ssh-agent | sed "/^echo/d"`
    [ -f $SSH_ENV ] && return 0 || echo $content > $SSH_ENV
    chmod 600 "${SSH_ENV}"
    . "${SSH_ENV}" > /dev/null
    /usr/bin/ssh-add ~/.ssh/*ed25519
    /usr/bin/ssh-add ~/.ssh/*rsa
}

if [ ! -d ~/.xiaket/var/tmp ]
then
    mkdir -p ~/.xiaket/var/tmp
fi

if [ "x$ADD_KEY" = "xyes" ]
then
    # Source SSH settings, if applicable
    lockfile -1 ~/.xiaket/var/tmp/ssh.lock
    if [ -f "${SSH_ENV}" ]; then
        . "${SSH_ENV}" > /dev/null
        ps auwxx | grep ${SSH_AGENT_PID} | grep -q ssh-agent$
        if [ $? -ne 0 ]
        then
            rm -f ${SSH_ENV}
            start_agent
        fi
    else
        start_agent;
    fi
    rm -f ~/.xiaket/var/tmp/ssh.lock
fi

# For Alternative settings
if [ -f "$altdir/etc/bashrc" ]
then
    . "$altdir/etc/bashrc"
fi
