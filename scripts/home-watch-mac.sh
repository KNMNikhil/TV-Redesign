#!/usr/bin/env bash
# Optional: run home_watch.py in the background on a Mac (starts at login, restarts if it stops).
#   TV_HOST=<TV_IP> ./scripts/home-watch-mac.sh            # install
#   ./scripts/home-watch-mac.sh uninstall                  # remove it again
# It only works while the Mac is awake and on the same network as the TV.
set -euo pipefail
cd "$(dirname "$0")/.."
LABEL=com.knmnikhil.tvredesign.homewatch
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/tv-redesign-home-watch.log"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if [ "${1:-}" = uninstall ]; then
  rm -f "$PLIST"
  echo "Removed. The Home button opens LG's home screen again."
  exit 0
fi

: "${TV_HOST:?set TV_HOST to the IP address of the TV}"
[ -x venv/bin/python ] || { echo "Run scripts/setup-tools.sh first." >&2; exit 1; }

mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PWD/venv/bin/python</string>
    <string>-u</string>
    <string>$PWD/scripts/home_watch.py</string>
    <string>$TV_HOST</string>
  </array>
  <key>WorkingDirectory</key><string>$PWD</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Running. Log: $LOG"
