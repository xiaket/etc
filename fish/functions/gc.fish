function gc
    set __gc_new_files (git status --short | grep '^??' | awk '{print $NF}' | sed "s/\n/ /g")
    if test -n "$__gc_new_files"
        echo "Adding new files: " $new_files
        for file in (git status --short | grep '^??' | awk '{print $NF}')
            read -p 'echo "Adding $file, sure?(y/n):"' -l choice
            if test "$choice" = "y"
                git add $file
                set added_files (echo $added_files $file)
            end
        end
    end
    git commit -vs $argv $added_files
end
