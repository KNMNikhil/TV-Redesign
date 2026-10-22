#!/usr/bin/env bash
# Installs the two tools this project uses, both pinned and kept inside the project folder:
#   venv/   Python environment with the websocket library (requirements.txt)
#   tools/  LG's webOS command-line tools (version fixed in tools/package.json), installed without
#           running any package install scripts
# Nothing is installed globally.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv venv
venv/bin/pip install --quiet --require-virtualenv -r requirements.txt
npm install --prefix tools --ignore-scripts --no-audit --no-fund
echo "Ready. Next: follow docs/SETUP.md to register your TV, then run install.sh."
