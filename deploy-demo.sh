#!/usr/bin/env bash
# deploy-demo.sh — Upload travel-diary demo to prasadgupte.com via FTP
# Credentials read from ~/.netrc (machine 88.223.85.18)
# Usage: bash deploy-demo.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FTP="ftp://88.223.85.18"
REMOTE="travel-diary-demo"

upload() {
  local src="$1" dst="$2"
  echo -n "  ↑  $dst ... "
  curl --silent --show-error --ftp-pasv --netrc --ftp-create-dirs \
    -T "$src" "$FTP/$REMOTE/$dst"
  echo "done"
}

echo "📤  Deploying travel-diary demo → prasadgupte.com/travel-diary-demo/"
echo

# App files
for f in index.html app.jsx data.js globe.jsx charts.jsx map2d.jsx \
         timeline.jsx quiz.jsx tokens.css enrichment.js iso-lookup.js \
         autoplay.jsx tweaks-panel.jsx airport_enrichment.js icons.jsx \
         trip.jsx trip.css trip-hourly.jsx trip-summary.jsx trip-timeline.jsx trip-drawer.jsx \
         trip-map.jsx; do
  upload "$SCRIPT_DIR/$f" "$f"
done

# Sample data
for f in sample_tracker.csv sample_alex.csv sample_tsu.csv \
         sample_ari.csv sample_rumi.csv sample_kiran.csv; do
  upload "$SCRIPT_DIR/sample/$f" "sample/$f"
done

# Config: flights.json.example → flights.json
upload "$SCRIPT_DIR/flights.json.example" "flights.json"

# Data subdirectories
upload "$SCRIPT_DIR/master_data/airports.json" "master_data/airports.json"
upload "$SCRIPT_DIR/sample/sample_countries.csv" "data/countries.csv"

echo
echo "✅  Done. Visit https://prasadgupte.com/travel-diary-demo/"
