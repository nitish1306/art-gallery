#!/bin/sh
# Bootstrap the persistent volume with default data on first deploy.
# Uses cp -n (no-clobber) so existing files are never overwritten.

set -e

# Create directory structure on the volume
mkdir -p /data/data
mkdir -p /data/public/assets/artworks/thumbs
mkdir -p /data/public/assets/textures
mkdir -p /data/public/assets/audio

# Seed JSON config files (only if they don't exist yet)
cp -n /app/data/*.json /data/data/ 2>/dev/null || true

# Seed bundled textures and audio (only missing files)
cp -rn /app/public/assets/textures/* /data/public/assets/textures/ 2>/dev/null || true
cp -rn /app/public/assets/audio/* /data/public/assets/audio/ 2>/dev/null || true

echo "Volume bootstrapped. Starting server..."
exec node server/index.js
