local hiper = require('hiper').new('rightcmd')
local magnet = require('magnet')

local features = {
  -- Simple app maps
  b = 'Books',
  d = 'Dash',
  f = 'Finder',
  k = 'Kitty',
  l = 'Slack',
  m = 'Mail',
  o = 'Obsidian',
  s = 'Safari',
  t = 'Typora',
  x = 'Firefox',

  -- Rebalance the audio output, sometime my WH-H900N will end up unbalanced
  a = function() hs.audiodevice.current()['device']:setBalance(0.5) end,
  -- Debug
  h = function() hs.reload(); hs.console.clearConsole() end,
  -- Lock screen
  i = function() hs.osascript.applescript('tell application "System Events" to keystroke "q" using {command down,control down}') end,
  -- Pause/Play audio
  p = function() require('hs.eventtap').event.newSystemKeyEvent("PLAY", true):post() end,
}

-- Windows management features
magnetCommands = {"0", "1", "2", "3", "4", ",", "."}
for i = 1, 7 do
  features[magnetCommands[i]] = function() magnet(magnetCommands[i]) end
end

for key, feature in pairs(features) do
  if type(feature) == 'string' then
    features[key] = function() hs.application.launchOrFocus(feature) end
  end
end

hiper.load_features(features)
