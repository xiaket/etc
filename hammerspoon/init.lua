local hiper = require('hiper').new('rightcmd')

local features = {
  -- Rebalance the audio output, sometime my WH-H900N will end up unbalanced
  a = function() hs.audiodevice.current()['device']:setBalance(0.5) end,
  d = 'Dash',
  f = 'Finder',
  -- Debug
  h = function() hs.reload(); hs.console.clearConsole() end,
  -- Lock screen
  i = function() hs.osascript.applescript('tell application "System Events" to keystroke "q" using {command down,control down}') end,
  k = 'Kitty',
  l = 'Slack',
  m = 'Mail',
  -- Pause/Play audio
  p = function() require('hs.eventtap').event.newSystemKeyEvent("PLAY", true):post() end,
  s = 'Safari',
  t = 'Typora',
  x = 'Firefox',
}

for key, feature in pairs(features) do
  if type(feature) == 'string' then
    hiper.bind(key, function() hs.application.launchOrFocus(feature) end)
  else
    hiper.bind(key, feature)
  end
end
