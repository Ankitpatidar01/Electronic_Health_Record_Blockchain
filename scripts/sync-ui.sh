#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_UI="$ROOT_DIR/packages/caregrid-ui/src"
SOURCE_ASSETS="$ROOT_DIR/packages/caregrid-ui/assets"

echo "=== Syncing CareGrid UI Kit to all frontends ==="

TARGET_APPS=(
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/patient-portal"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal"
  "orgs/pharmacy/fabric-network-swarm/app/frontend"
)

for app in "${TARGET_APPS[@]}"; do
  APP_DIR="$ROOT_DIR/$app"
  if [ -d "$APP_DIR" ]; then
    echo "Syncing to $app..."
    mkdir -p "$APP_DIR/src/ui-kit"
    cp -r "$SOURCE_UI"/* "$APP_DIR/src/ui-kit/"

    # Also sync assets to public/assets
    mkdir -p "$APP_DIR/public/assets"
    cp -r "$SOURCE_ASSETS"/* "$APP_DIR/public/assets/"
  fi
done

# Sync vanilla JS apps (tokens & assets)
echo "Syncing tokens to Lab gateway..."
mkdir -p "$ROOT_DIR/orgs/lab/EHR-LABORG-main/client/node-gateway/public/assets"
cp -r "$SOURCE_ASSETS"/* "$ROOT_DIR/orgs/lab/EHR-LABORG-main/client/node-gateway/public/assets/"
cp "$SOURCE_UI/tokens.css" "$ROOT_DIR/orgs/lab/EHR-LABORG-main/client/node-gateway/public/caregrid-tokens.css"

echo "Syncing tokens to Nginx Hub..."
mkdir -p "$ROOT_DIR/nginx/hub/assets"
cp -r "$SOURCE_ASSETS"/* "$ROOT_DIR/nginx/hub/assets/"
cp "$SOURCE_UI/tokens.css" "$ROOT_DIR/nginx/hub/caregrid-tokens.css"

echo "=== Sync completed successfully ==="
