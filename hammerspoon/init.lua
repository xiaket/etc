local hyper = require('hyperex').new('rightcmd')

apps = {
  {'d', 'Dash'},
  {'f', 'Finder'},
  {'k', 'Kitty'},
  {'l', 'Slack'},
  {'m', 'Mail'},
  {'s', 'Safari'},
  {'t', 'Typora'},
  {'x', 'Firefox'},
}

for i, app in ipairs(apps) do
  hyper:bind(app[1]):to(function() hs.application.launchOrFocus(app[2]) end)
end

-- Rebalance the audio output, sometime my WH-H900N will end up inbalanced
hyper:bind("a"):to(
  function()
    hs.audiodevice.current()['device']:setBalance(0.5)
  end
)

-- Lock screen
hyper:bind("i"):to(
  function()
    hs.osascript.applescript('tell application "System Events" to keystroke "q" using {command down,control down}')
  end
)

-- Pause/Play audio
hyper:bind("p"):to(
  function()
    local event = require('hs.eventtap').event
    event.newSystemKeyEvent("PLAY", true):post()
  end
)
