function proxy
    set kde_file ~/.config/kioslaverc
    set kde_settings (grep "^ProxyType" $kde_file | cut -d "=" -f 2)
    set yast_settings (grep PROXY_ENABLED /etc/sysconfig/proxy | sed "s/\"/ /g" | cut -d " " -f 2)
    if test "$kde_settings" = "1"
        if test "$yast_settings" = "no"
            echo "bad settings: kde on, yast off"
            return 1
        else
            echo "proxy turned off"
            sed -i "s/^ProxyType=1/ProxyType=0/g" $kde_file ; and sudo sed -i "s/PROXY_ENABLED=\"yes\"/PROXY_ENABLED=\"no\"/g" /etc/sysconfig/proxy
        end
    else
        if test "$yast_settings" = "yes"
            echo "bad settings: kde off, yast on"
            return 1
        else
            echo "proxy turned on"
            sed -i "s/^ProxyType=0/ProxyType=1/g" $kde_file ; and sudo sed -i "s/PROXY_ENABLED=\"no\"/PROXY_ENABLED=\"yes\"/g" /etc/sysconfig/proxy
        end
    end

    echo "Ready to logout?"
    sleep 3
    env DISPLAY=:0 qdbus org.kde.ksmserver /KSMServer org.kde.KSMServerInterface.logout 0 0 0
end
