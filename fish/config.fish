set __fish_base_dir ~/.config/fish
set __xiaket_dir ~/.xiaket
set __etc_dir $__xiaket_dir/etc

. $__fish_base_dir/aliases.fish
set --universal fish_user_paths ~/.xiaket/etc/bin /bin /usr/bin /usr/local/bin /sbin /usr/sbin /usr/local/sbin

eval (dircolors -c $__etc_dir/dir_colors)

set --export PYTHONPATH $__xiaket_dir/python/
set --export PYTHONSTARTUP ~/.pythonrc
set --export GIT_EDITOR nvim

set fish_greeting ""
set -g fish_key_bindings fish_vi_key_bindings
