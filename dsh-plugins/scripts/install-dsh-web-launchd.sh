#!/bin/zsh
# Install dsh web as a per-user launchd service. No sudo is required.
set -euo pipefail

LABEL="com.xiaket.dsh.web"
SERVICE_DOMAIN="gui/$(id -u)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/.dsh/logs"
DEFAULT_WORKDIR="/Users/xiaket/.xiaket/share/github/etc"
WORKDIR="${DSH_WEB_WORKDIR:-$DEFAULT_WORKDIR}"
DSH_BIN="${DSH_BIN:-$(command -v dsh || true)}"

if [[ -z "$DSH_BIN" || ! -x "$DSH_BIN" ]]; then
  echo "dsh was not found. Install it first, or set DSH_BIN=/absolute/path/to/dsh." >&2
  exit 1
fi

if [[ ! -d "$WORKDIR" ]]; then
  echo "Working directory does not exist: $WORKDIR" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>$DSH_BIN</string>
    <string>web</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$WORKDIR</string>

  <!-- launchd supplies a minimal environment; preserve Homebrew's bin path. -->
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>$HOME</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/dsh-web.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/dsh-web.err.log</string>
</dict>
</plist>
EOF

# Replace a prior instance if it exists. bootout returns non-zero if absent.
launchctl bootout "$SERVICE_DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$SERVICE_DOMAIN" "$PLIST"
launchctl kickstart -k "$SERVICE_DOMAIN/$LABEL"

echo "Installed and started $LABEL"
echo "Service file: $PLIST"
echo "Open: http://127.0.0.1:3080"
echo "Logs: $LOG_DIR/dsh-web.out.log and $LOG_DIR/dsh-web.err.log"
