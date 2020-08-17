-- Module to manage windows in macos

hs.window.animationDuration = 0

function magnet(how)
  --[[
  Move current active window like magnet app do.
  Possible values for how and their meanings:
    left: move window to the left half of the current screen(possibly between screens)
    right: move window to the right half of the current screen(possibly between screens)
    0: Maximize current window
    1: Move window to the top left corner
    2: Move window to the top right corner
    3: Move window to the bottom left corner
    4: Move window to the bottom right corner
  ]]--
  local win = hs.window.focusedWindow()
  local frame = win:screen():fullFrame()

  if how == "0" then
    win:maximize()
  elseif how == "1" then
    win:setFrame({x=frame.x, y=frame.y, w=frame.w/2, h=frame.h/2})
  elseif how == "2" then
    win:setFrame({x=frame.x+frame.w/2, y=frame.y, w=frame.w/2, h=frame.h/2})
  elseif how == "3" then
    win:setFrame({x=frame.x, y=frame.y+frame.h/2, w=frame.w/2, h=frame.h/2})
  elseif how == "4" then
    win:setFrame({x=frame.x+frame.w/2, y=frame.y+frame.h/2, w=frame.w/2, h=frame.h/2})
  else
    sorted = sortScreens()
    if how == "," then
      moveLeft(sorted, win)
    elseif how == "." then
      moveRight(sorted, win)
    end
  end
end

function sortScreens()
  sorted = {}
  local inserted = false
  for screen, pos in pairs(hs.screen.screenPositions()) do
    inserted = false
    for i, s in ipairs(sorted) do
      x, y = s:position()
      if pos.x < x then
        table.insert(sorted, i, screen)
        inserted = true
        break
      end
    end
    if not inserted then
      table.insert(sorted, screen)
    end
  end
  return sorted
end

function moveLeft(sorted, win)
  local frame = win:screen():fullFrame()
  old = win:frame()
  win:setFrame({x=frame.x, y=frame.y, w=frame.w/2, h=frame.h})
  new = win:frame()
  if old.x ~= new.x or old.y ~= new.y or old.w ~= new.w or old.h ~= new.h then
    return
  end

  local frame = win:screen():fullFrame()

  local moveCross = false
  for i, screen in ipairs(sorted) do
    if screen:id() == win:screen():id() and i ~= 1 then
      moveCross = true
      break
    end
  end

  if not moveCross then
    return
  end

  win:moveOneScreenWest()
  local frame = win:screen():fullFrame()
  win:setFrame({x=frame.x+frame.w/2, y=frame.y, w=frame.w/2, h=frame.h})
end

function moveRight(sorted, win)
  local frame = win:screen():fullFrame()

  old = win:frame()
  win:setFrame({x=frame.x+frame.w/2, y=frame.y, w=frame.w/2, h=frame.h})
  new = win:frame()
  if old.x ~= new.x or old.y ~= new.y or old.w ~= new.w or old.h ~= new.h then
    return
  end

  frame = win:screen():fullFrame()

  local moveCross = false
  for i, screen in ipairs(sorted) do
    if screen:id() == win:screen():id() and i ~= #sorted then
      moveCross = true
      break
    end
  end

  if not moveCross then
    return
  end

  win:moveOneScreenEast()
  frame = win:screen():fullFrame()
  win:setFrame({x=frame.x, y=frame.y, w=frame.w/2, h=frame.h})
end

return magnet
