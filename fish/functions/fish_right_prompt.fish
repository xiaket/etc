function __cmd_duration -S -d 'Show command duration'
  [ "$CMD_DURATION" -lt 200 ]; and return

  set_color $fish_color_normal
  if [ "$CMD_DURATION" -lt 3000 ]
    echo -ns '[' $CMD_DURATION 'ms] '
  else
    echo -ns '['
    math "scale=1;$CMD_DURATION/1000" | sed 's/\\.0$//'
    echo -n 's] '
  end

  set_color $fish_color_normal
end

function __timestamp -d 'Show the current timestamp'
  set_color $fish_color_autosuggestion
  date +"[%H:%M:%S]"
end

function __git_base_dir
  set -l git_dir (command git rev-parse --git-dir ^/dev/null); or return
  set -l git_dir (echo $git_dir | sed "s/\/home\/xiaket/~/g")
  echo "[$git_dir] "
end

function __status_code -S -d 'Show the exit code if it is not zero'
  if test $last_status -gt 0
    set_color red
    echo -ns "[code: $last_status] "
    set_color $fish_color_normal
  end
  set_color $fish_color_normal
end

function fish_right_prompt -d 'the right prompt'
  set -l last_status $status

  __status_code
  set_color $fish_color_autosuggestion
  __cmd_duration
  __git_base_dir
  __timestamp
  set_color normal
end
