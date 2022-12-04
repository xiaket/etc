#!/bin/bash
# A bash implementation of hiper.lua and magnet.lua found in ~/hammerspoon
set -o errexit
set -o nounset
set -o pipefail

app="$1"

case "$app" in
  dolphin)
    class="dolphin.dolphin"
    bin="dolphin"
    action="switch"
    ;;
  firefox)
    class="Navigator.firefox"
    bin="firefox"
    action="switch"
    ;;
  kitty)
    class="kitty.kitty"
    bin="ARCH=Linux kitty"
    action="switch"
    ;;
  obsidian)
    class="obsidian.obsidian"
    bin="~/Applications/Obsidian-0.15.9.AppImage"
    action="switch"
    ;;
  yast)
    class="YaST2.org.opensuse.YaST"
    bin="/usr/bin/xdg-su -c /sbin/yast2"
    action="switch"
    ;;
  zeal)
    class="zeal.Zeal"
    bin="zeal"
    action="switch"
    ;;
  0)
    x=0
    y=0
    width=3840
    height=2160
    action="move"
    ;;
  1)
    x=0
    y=0
    width=1920
    height=1080
    action="move"
    ;;
  2)
    x=1920
    y=0
    width=1920
    height=1080
    action="move"
    ;;
  3)
    x=0
    y=1080
    width=1920
    height=1080
    action="move"
    ;;
  4)
    x=1920
    y=1080
    width=1920
    height=1080
    action="move"
    ;;
  left)
    x=0
    y=0
    width=1920
    height=2160
    action="move"
    ;;
  right)
    x=1920
    y=0
    width=1920
    height=2160
    action="move"
    ;;
esac

if [ "$action" = "switch" ]
then
  wm_output=$(wmctrl -l -x | awk '{print $1, $3}' | grep "$class" || echo "inactive")

  if [ "$wm_output" = "inactive" ]
  then
    eval "$bin"
  else
    win_id=$(echo "$wm_output" | cut -d " " -f 1)
    wmctrl -i -a "$win_id"
  fi
else
  win_id=$(xdotool getactivewindow)
  xdotool windowsize "$win_id" "$width" "$height"
  xdotool windowmove "$win_id" "$x" "$y"
fi
