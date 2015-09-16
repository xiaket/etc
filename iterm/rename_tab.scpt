tell application "iTerm"
    activate

    set current_name to the name of current session of first window

    try
        display dialog "Rename Tab" default answer current_name
    on error
        -- User canceled
        return current_name
    end try

    set newname to (text returned of result)
    tell current session of first window
        set name to newname
    end tell
end tell
