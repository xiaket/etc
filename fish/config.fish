set __fish_base_dir ~/.config/fish
set __xiaket_dir ~/.xiaket
set __etc_dir $__xiaket_dir/etc


set --universal fish_user_paths ~/.xiaket/etc/bin /bin /usr/bin /usr/local/bin /sbin /usr/sbin /usr/local/sbin

eval (dircolors -c $__etc_dir/dir_colors)

set --export PYTHONPATH "$PYTHONPATH:$__xiaketDIR/python/"
set --export PYTHONSTARTUP=~/.pythonrc
set --export GIT_EDITOR=nvim

. $__fish_base_dir/aliases.fish
