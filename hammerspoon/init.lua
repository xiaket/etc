local hiper = require("hiper").new("rightcmd")
local magnet = require("magnet")
local is_switch = require("is_switch")

-- Get hostname for host-specific configurations
local hostname = hs.host.localizedName():gsub("%.local$", "")

-- Base features available on all hosts
local baseFeatures = {
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
  o = "Bitwarden",
  s = "Superlist",

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

-- Host-specific features
local hostFeatures = {}

-- Configure features based on hostname
if hostname == "Bragg" then
  hostFeatures = {
    z = "zoom.us",
  }
elseif hostname == "Feynman" then
  hostFeatures = {
    w = "WeChat",
    x = "Xcode-beta",
  }
end

-- Merge base features with host-specific features
local features = {}
for k, v in pairs(baseFeatures) do
  features[k] = v
end
for k, v in pairs(hostFeatures) do
  features[k] = v
end

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
