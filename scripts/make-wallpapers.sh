#!/usr/bin/env bash
# Prepare your own wallpaper images for the launcher (macOS: uses the built-in sips tool).
#   scripts/make-wallpapers.sh photo1.png photo2.png photo3.png
# For each image N (in order) this creates, under app/wallpapers/:
#   N.png        the wallpaper, at most 1920 pixels wide
#   thumb/N.png  the small preview in the picker
#   blur/N.png   a tiny copy that is shown enlarged behind All apps (a pre-blurred image costs the TV nothing)
# Names and order are set in app/config.js (photos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/app/wallpapers"
mkdir -p "$OUT/thumb" "$OUT/blur"
n=0
for src in "$@"; do
  n=$((n + 1))
  [ -f "$src" ] || { echo "Not a file: $src" >&2; exit 1; }
  sips -Z 1920 -s format png "$src" --out "$OUT/$n.png" >/dev/null
  sips -z 180 320 "$OUT/$n.png" --out "$OUT/thumb/$n.png" >/dev/null
  sips -z 72 128 "$OUT/$n.png" --out "$OUT/blur/$n.png" >/dev/null
  echo "Wallpaper $n ready"
done
