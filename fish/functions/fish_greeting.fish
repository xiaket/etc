function fish_greeting -d "what's up, fish?"
  set_color $fish_color_autosuggestion
  set __tmp_greeting_datestr (date +"%Y-%m-%d %H:%M:%S")
  set __tmp_greeting_uptime (uptime | awk '{print $(NF-2), $(NF-1), $NF}')
  echo "$__tmp_greeting_datestr [$__tmp_greeting_uptime]"
  set_color normal
end
