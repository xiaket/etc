local hiper = require('hiper').new('rightcmd')
local magnet = require('magnet')
local power = require('power')

local features = {
  -- Simple app maps
  a = 'Arc',
  b = 'Books',
  c = 'Canva',
  d = 'Dash',
  f = 'Finder',
  k = 'Kitty',
  l = 'Slack',
  m = 'Music',
  o = 'Obsidian',
  -- s = 'Safari',
  x = 'Firefox',
  w = 'WeChat',
  z = 'zoom.us',

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
