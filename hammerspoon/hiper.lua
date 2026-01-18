local realFlagMask = {
  [0x37] = 8, -- lcmd  0000 1000
  [0x36] = 16, -- rcmd 0001 0000
  [0x3a] = 32, -- lalt 0010 0000
  [0x3d] = 64, -- ralt 0100 0000
  [0x3b] = 1, -- lctrl 0000 0001
  [0x3e] = 8192, -- rctrl 10 0000 0000 0000
  [0x38] = 2, -- lshift 0000 0010
  [0x3c] = 4, -- rshift 0000 0100
}

Hiper = {}
Hiper.new = function(key_name)
  local self = {
    features = {},
    stopTimer = nil,
  }
  self.key = hs.keycodes.map[key_name]

  local modifierHandler = function(event)
    local keyCode = event:getKeyCode()
    local realFlags = event:getRawEventData().CGEventData.flags

    if keyCode ~= self.key then
      return false
    end

    local mask = realFlagMask[self.key]
    if mask == nil then
      return false
    end

    if (realFlags & mask) == mask then
      -- Cancel any pending stop operation
      if self.stopTimer then
        self.stopTimer:stop()
        self.stopTimer = nil
      end
      if not self.featureTap:isEnabled() then
        self.featureTap:start()
      end
    else
      -- Debounce: delay stop to avoid spurious release events
      if self.featureTap:isEnabled() and not self.stopTimer then
        self.stopTimer = hs.timer.doAfter(0.05, function()
          if self.featureTap:isEnabled() then
            self.featureTap:stop()
          end
          self.stopTimer = nil
        end)
      end
    end
    return false
  end

  local featureHandler = function(event)
    local keyCode = event:getKeyCode()
    local isKeyUp = event:getType() ~= hs.eventtap.event.types.keyDown
    local isRepeat = not isKeyUp
      and event:getProperty(hs.eventtap.event.properties["keyboardEventAutorepeat"]) ~= 0
    local realFlags = event:getRawEventData().CGEventData.flags

    -- Verify hyper key is still pressed (fixes stale state after screen unlock)
    local mask = realFlagMask[self.key]
    if mask and (realFlags & mask) ~= mask then
      self.featureTap:stop()
      if self.stopTimer then
        self.stopTimer:stop()
        self.stopTimer = nil
      end
      return false
    end

    -- Handle hyper key itself
    if keyCode == self.key then
      return not isKeyUp
    end

    -- Only process keydowns that aren't repeats
    if isKeyUp or isRepeat or not self.features[keyCode] then
      return false
    end

    local feature = self.features[keyCode]
    local shiftPressed = event:getFlags().shift

    -- Execute appropriate function based on type and case
    if type(feature) == "function" then
      feature() -- Legacy format
    elseif type(feature) == "table" then
      if shiftPressed and feature.hasUpper then
        feature.upperFn()
      elseif not shiftPressed and feature.hasLower then
        feature.lowerFn()
      end
    end

    return true
  end

  self.featureTap = hs.eventtap.new(
    { hs.eventtap.event.types.keyDown, hs.eventtap.event.types.keyUp },
    featureHandler
  )
  self.modifierTap = hs.eventtap.new({ hs.eventtap.event.types.flagsChanged }, modifierHandler)
  self.modifierTap:start()

  self.load_features = function(features)
    local keymap = {}

    -- Collect keycodes with case info
    for key, fn in pairs(features) do
      local keycode = hs.keycodes.map[key:lower()]
      if keycode then
        keymap[keycode] = keymap[keycode] or {}

        -- Store function based on case
        if key:match("[A-Z]") then
          keymap[keycode].upperFn = fn
          keymap[keycode].hasUpper = true
        else
          keymap[keycode].lowerFn = fn
          keymap[keycode].hasLower = true
        end
      end
    end

    -- Map to final features table
    for keycode, info in pairs(keymap) do
      self.features[keycode] = info
    end
  end

  return self
end

return Hiper
