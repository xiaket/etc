tell application "iTerm 2"
    activate
    
    set current_name to the name of current session of current window
    display dialog "Rename Tab" default answer current_name
    set newname to (text returned of result)
    tell current session of current window
        set name to newname
    end tell
end tell
