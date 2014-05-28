##############
# The basics #
##############
[ -z "$PS1" ] && return

xiaketDIR="/Users/xiaket/.xiaket"
bashrcdir=$xiaketDIR"/etc"
bindir=$xiaketDIR"/bin"

export PATH="~/.xiaket/etc/bin:~/.xiaket/bin.mac:~/.xiaket/bin:/usr/local/bin:/bin:/usr/bin:/sbin:/usr/sbin:/usr/local/sbin:/usr/local/mysql/bin:/usr/local/opt/coreutils/bin:/usr/local/texlive/2013/bin/x86_64-darwin:/usr/local/share/npm/bin"
MANPATH="/usr/local/opt/coreutils/libexec/gnuman:$MANPATH"

############
# sourcing #
#############

. $bashrcdir/alias
. /usr/local/etc/bash_completion

. /Users/xiaket/.xiaket/share/repos/pub-repos/github/django/extras/django_bash_completion
. $bashrcdir/ntes

# If we are logging through tty, set locale to en_US.UTF-8
TTY=`tty | grep tty -c`
if [ $TTY == 1 ]
then
    export LANG=en_US.UTF-8
else
    export LANG=zh_CN.UTF-8
fi

YELLOW=$(tput setaf 136)
ORANGE=$(tput setaf 166)
RED=$(tput setaf 160)
MAGENTA=$(tput setaf 125)
VIOLET=$(tput setaf 61)
BLUE=$(tput setaf 33)
CYAN=$(tput setaf 37)
GREEN=$(tput setaf 64)
BOLD=$(tput bold)
RESET=$(tput sgr0)
 

# use ascii colors to show whether we are root.
if [ $UID -eq 0 ]
then
    export PS1="[\[${RED}\]\u@\[$CYAN\]\h \[$BLUE\]\w\[$RESET\]]" 
else
    export PS1="[\[${ORANGE}\]\u\[$CYAN\]@\h \[$BLUE\]\w\[$RESET\]]" 
fi


################
# bash history #
################

# don't put duplicate lines in the history. See bash(1) for more options
export HISTCONTROL=ignoredups
export HISTSIZE=500000
export HISTTIMEFORMAT="%h/%d - %H:%M:%S "

# append to the history file, don't overwrite it
shopt -s histappend
PROMPT_COMMAND=`$PROMPT_COMMAND; history -a`

#########################
# environment variables #
#########################

# Setup Python PATH, so our python libraries would be portable.
export PYTHONPATH="$PYTHONPATH:/Users/xiaket/.xiaket/python:/Users/xiaket/.xiaket/python/lib"
export PYTHONSTARTUP=~/.pythonrc
export NODE_PATH="$NODE_PATH:/usr/local/lib/node_modules:/usr/local/share/npm/lib/node_modules"
export SVN_EDITOR=vim

#################
# accessibility #
#################

export LS_OPTIONS='--color=auto'
eval `gdircolors "$HOME/.xiaket/etc/dir_colors"`

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
    /usr/bin/ssh-add
}

# Source SSH settings, if applicable
lockfile -1 /tmp/ssh.lock
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
rm -f /tmp/ssh.lock
