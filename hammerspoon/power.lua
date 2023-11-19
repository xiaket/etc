-- src: https://github.com/Hammerspoon/hammerspoon/issues/2314
-- with minor mods.

caffeine = hs.menubar.new()

-- Always caffeinate on startup.
shouldCaffeinate = false

function setCaffeineDisplay(state)
  if state then
    caffeine:setTitle("on")
  else
    caffeine:setTitle("off")
  end
end

function setCaffeine(state)
  hs.caffeinate.set("displayIdle", state, true)
  setCaffeineDisplay(state)
end

function caffeineClicked()
  shouldCaffeinate = not shouldCaffeinate
  setCaffeine(shouldCaffeinate)
end

if caffeine then
  caffeine:setClickCallback(caffeineClicked)
  setCaffeine(shouldCaffeinate)
end

local pow = hs.caffeinate.watcher
local log = hs.logger.new("caffeine", "verbose")

local function on_pow(event)
  local name = "?"
  for key, val in pairs(pow) do
    if event == val then
      name = key
    end
  end
  log.f("caffeinate event %d => %s", event, name)
  if event == pow.screensDidUnlock or event == pow.screensaverDidStop then
    log.i("Screen awakened!")
    -- Restore Caffeinated state:
    setCaffeine(shouldCaffeinate)
    return
  end
  if event == pow.screensDidLock or event == pow.screensaverDidStart then
    log.i("Screen locked.")
    setCaffeine(false)
    return
  end
end

-- Listen for power events, callback on_pow().
pow.new(on_pow):start()
log.i("Started.")
