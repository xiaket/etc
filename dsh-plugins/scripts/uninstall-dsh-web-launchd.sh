#!/bin/zsh
# Stop and remove the per-user dsh web launchd service. No sudo is required.
set -euo pipefail

LABEL="com.xiaket.dsh.web"
SERVICE_DOMAIN="gui/$(id -u)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "$SERVICE_DOMAIN/$LABEL" 2>/dev/null || true
rm -f "$PLIST"
echo "Stopped and removed $LABEL"
