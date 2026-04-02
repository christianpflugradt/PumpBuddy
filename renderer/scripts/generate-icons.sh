#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../public"

cd "$PUBLIC_DIR"

MASTER_APP_ICON="icon.png"
MASTER_FAVICON="favicon.png"

magick "$MASTER_APP_ICON" -filter Lanczos -resize 512x512 "icon-512.png"
magick "$MASTER_APP_ICON" -filter Lanczos -resize 192x192 "icon-192.png"
magick "$MASTER_APP_ICON" -filter Lanczos -resize 180x180 "apple-touch-icon.png"

magick "$MASTER_FAVICON" -filter Lanczos -resize 48x48 "favicon-48.png"
magick "$MASTER_FAVICON" -filter Lanczos -resize 32x32 "favicon-32.png"
magick "$MASTER_FAVICON" -filter Lanczos -resize 16x16 "favicon-16.png"

magick "favicon-16.png" "favicon-32.png" "favicon-48.png" "favicon.ico"

rm -f "favicon-16.png" "favicon-32.png" "favicon-48.png"
