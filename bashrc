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
export ARCH=`uname -s`
 
if [ "x$ARCH" = "xLinux" ]
then
    export MAN_POSIXLY_CORRECT=1
    # running on a linux virtual machine.
    COLORS=dircolors
else
    # running on a macOS machine.
    COLORS=gdircolors
fi

xiaketDIR=~/.xiaket
etcdir=$xiaketDIR"/etc"
altdir=$xiaketDIR"/alt"

# PATH ordering policy: Alt dir things > My own script > Homebrew > System, bin > sbin
export PATH="$altdir/bin:~/.xiaket/etc/bin:~/.xiaket/go/bin:/usr/local/bin:/usr/local/sbin:/bin:/usr/bin:/sbin/usr/sbin:~/Library/Python/2.7/bin:/usr/local/opt/coreutils/bin"
export MANPATH="/usr/local/opt/coreutils/libexec/gnuman:$MANPATH"
export LANG=en_US.UTF-8

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

function _xiaket_prompt {
  PS1="$(my_prompt $?)"
  history -a; history -n;
}

export PROMPT_COMMAND='_xiaket_prompt'

# For bash completion.
. "$etcdir"/bash_completion


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

# Source SSH settings, if applicable
[ ! -d ~/.xiaket/var/tmp ] || mkdir -p ~/.xiaket/var/tmp
lockfile -1 ~/.xiaket/var/tmp/ssh.lock
if [ -f "${SSH_ENV}" ]; then
    . "${SSH_ENV}" > /dev/null
    ps ${SSH_AGENT_PID} | grep -q ssh-agent$
    if [ $? -ne 0 ]
    then
        rm -f ${SSH_ENV}
        start_agent
    fi
else
    start_agent;
fi
rm -f ~/.xiaket/var/tmp/ssh.lock

# For Alternative settings
if [ -f "$altdir/etc/bashrc" ]
then
    . "$altdir/etc/bashrc"
fi
