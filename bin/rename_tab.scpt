tell application "iTerm 2"
    activate
    
    set current_name to the name of current session of current window
    try
      display dialog "Rename Tab" default answer current_name
      set newname to (text returned of result)
    on error
      set newname to current_name
    end try
    tell current session of current window
        set name to newname
    end tell
end tell
