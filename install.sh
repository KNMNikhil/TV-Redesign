#!/usr/bin/env bash
# Sync your TV's apps, package the launcher and install it on a TV that is in Developer Mode.
#   TV_HOST=<TV_IP> ./install.sh
# One-time setup first: see docs/SETUP.md (Developer Mode, device key, scripts/setup-tools.sh).
# Remove it again with:  tools/node_modules/.bin/ares-install -d lgtv -r com.knmnikhil.tvredesign
set -euo pipefail
cd "$(dirname "$0")"
: "${TV_HOST:?set TV_HOST to the IP address of the TV, for example: TV_HOST=<TV_IP> ./install.sh}"
DEVICE="${DEVICE:-lgtv}"
BIN="tools/node_modules/.bin"
PY="venv/bin/python"
for need in "$PY" "$BIN/ares-package" "$BIN/ares-install" "$BIN/ares-launch"; do
  [ -x "$need" ] || { echo "Missing $need. Run scripts/setup-tools.sh first." >&2; exit 1; }
done
APP_ID="$("$PY" -c "import json; print(json.load(open('app/appinfo.json'))['id'])")"

"$PY" scripts/sync_apps.py "$TV_HOST"

rm -rf build && mkdir build
"$BIN/ares-package" app -o build
"$BIN/ares-install" -d "$DEVICE" "build/${APP_ID}_"*.ipk
"$BIN/ares-launch" -d "$DEVICE" "$APP_ID"
echo "Installed. Hold a number key on the remote while the launcher is open to make it a one-press shortcut."
