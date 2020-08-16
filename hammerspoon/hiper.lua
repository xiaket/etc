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
    }
    self.key = hs.keycodes.map[key_name]

    local modifierTap = function(event)
        local keyCode = event:getKeyCode()
        if keyCode ~= self.key then
            return
        end

        local realFlags = event:getRawEventData().CGEventData.flags
        local mask = realFlagMask[self.key]
        if mask == nil then
            return
        end

        if (realFlags & mask) == mask then
            -- print(keyCode, 'press', (realFlags))
            if not self.featureTap:isEnabled() then
                self.featureTap:start()
            end
        else
            -- print(keyCode, 'release', (realFlags))
            if self.featureTap:isEnabled() then
                self.featureTap:stop()
            end
        end
        return
    end

    local featureHandler = function(event)
        local keyCode = event:getKeyCode()
        local isKeyDown = event:getType() == hs.eventtap.event.types.keyDown

        if keyCode == self.key then
            return isKeyDown
        end

        if isKeyDown and self.features[keyCode] ~= nil then
            self.features[keyCode]()
            return true
        end

        return false
    end

    hs.eventtap.new({hs.eventtap.event.types.flagsChanged}, modifierTap):start()
    self.featureTap = hs.eventtap.new({hs.eventtap.event.types.keyDown, hs.eventtap.event.types.keyUp}, featureHandler)

    self.bind = function(featureKey, func)
        self.features[hs.keycodes.map[featureKey]] = func
    end

    return self
end

return Hiper
