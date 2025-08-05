local hiper = require("hiper").new("rightcmd")
local magnet = require("magnet")
local power = require("power")
local is_switch = require("is_switch")

local features = {
  -- Simple app maps
  a = "Safari",
  b = "Books",
  c = "Canva",
  f = "Finder",
  g = "Cherry Studio",
  k = "Kitty",
  l = "Slack",
  m = "Mail",
  n = "Notes",
  s = "Superlist",
  w = "WeChat",
  z = "zoom.us",

  -- uppercase as we are running low on characters
  C = "Calendar",
  M = "Music",

  -- Debug
  h = function()
    hs.reload()
    hs.console.clearConsole()
  end,
  -- Lock screen
  i = function()
    hs.osascript.applescript(
      'tell application "System Events" to keystroke "q" using {command down,control down}'
    )
  end,
  -- Pause/Play audio
  p = function()
    require("hs.eventtap").event.newSystemKeyEvent("PLAY", true):post()
  end,
}

-- Windows management features
magnetCommands = { "0", "1", "2", "3", "4", ",", "." }
for i = 1, 7 do
  features[magnetCommands[i]] = function()
    magnet(magnetCommands[i])
  end
end

for key, feature in pairs(features) do
  if type(feature) == "string" then
    features[key] = function()
      hs.application.launchOrFocus(feature)
    end
  end
end

hiper.load_features(features)
