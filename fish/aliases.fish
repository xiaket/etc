# Generic 
alias grep 'grep --color'
alias vi 'nvim'
alias su 'su -'
alias df 'df -h'
alias diff 'colordiff'

# Typos
alias clera 'clear'
alias ls-l 'ls -l'
alias mkae 'make'
alias maek 'make'
alias gti 'git'

# Acesssibilities
alias c 'clear'
alias md 'mkdir -p'
alias which 'type -p'
alias .. 'cd ..'
alias ... 'cd ../..'
alias .... 'cd ../../..'
alias rc 'find . -name "*.pyc" -delete'
alias rt 'rm -f *.torrent'
alias mn 'make clean'
alias mt 'make test'
alias :q 'exit'
alias ZZ 'exit'
alias py 'python2.7'
alias daemon 'supervisorctl -c ~/.supervisord.conf'
alias lsvn '/usr/bin/svn'
alias go colorgo

alias randport 'python -c "import random; print random.randint(1025, 65535)"'
alias randword 'python -c "import random; print random.choice(open(\"/usr/share/dict/words\").readlines()).strip()"'
alias pylint 'python -c "import sys; from pylint.lint import Run; Run(sys.argv[1:])"'
alias lvi 'nvim --noplugin'
alias beep 'python -c "import time; print \"\a\"; time.sleep(0.5); print \"\a\""'
