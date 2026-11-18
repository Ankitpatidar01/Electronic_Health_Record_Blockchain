#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DS_DIR="$ROOT_DIR/design-system"

echo "=== Syncing the shared design system across all apps ==="

# dashboard-portal is the reference design: it is never overwritten by this
# script. observatory-theme.css is derived from its stylesheet.
REACT_APPS=(
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/hospital-portal"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/patient-portal"
  "orgs/hospital/EHR_hospitalOrg-main/ehr-frontend-v2/dashboard-portal"
  "orgs/pharmacy/fabric-network-swarm/app/frontend"
)

for app in "${REACT_APPS[@]}"; do
  TARGET="$ROOT_DIR/$app"
  if [ -d "$TARGET" ]; then
    echo "Syncing to $app..."
    mkdir -p "$TARGET/src/design-system/components"
    mkdir -p "$TARGET/public"

    cp "$DS_DIR/tokens.css" "$TARGET/src/design-system/tokens.css"
    cp "$DS_DIR/observatory-theme.css" "$TARGET/src/design-system/observatory-theme.css"
    cp "$DS_DIR/brand.config.js" "$TARGET/src/design-system/brand.config.js"
    cp "$DS_DIR/brand.config.json" "$TARGET/src/design-system/brand.config.json"
    cp -r "$DS_DIR/components/"* "$TARGET/src/design-system/components/"

    # Copy Favicon and Logo SVGs
    cp "$DS_DIR/assets/favicon.svg" "$TARGET/public/favicon.svg"
    cp "$DS_DIR/assets/logo.svg" "$TARGET/public/logo.svg"
    cp "$DS_DIR/assets/mesh-background.svg" "$TARGET/public/mesh-background.svg"
  fi
done

# Sync to Vanilla Apps
echo "Syncing to Nginx Hub..."
mkdir -p "$ROOT_DIR/nginx/hub"
cp "$DS_DIR/tokens.css" "$ROOT_DIR/nginx/hub/vitalis-tokens.css"
cp "$DS_DIR/observatory-theme.css" "$ROOT_DIR/nginx/hub/observatory-theme.css"
cp "$DS_DIR/assets/favicon.svg" "$ROOT_DIR/nginx/hub/favicon.svg"
cp "$DS_DIR/assets/logo.svg" "$ROOT_DIR/nginx/hub/logo.svg"
cp "$DS_DIR/assets/mesh-background.svg" "$ROOT_DIR/nginx/hub/mesh-background.svg"

echo "Syncing to Lab Gateway..."
mkdir -p "$ROOT_DIR/orgs/lab/EHR-LABORG-main/client/node-gateway/public"
cp "$DS_DIR/tokens.css" "$ROOT_DIR/orgs/lab/EHR-LABORG-main/client/node-gateway/public/vitalis-tokens.css"
cp "$DS_DIR/observatory-theme.css" "$ROOT_DIR/orgs/lab/EHR-LABORG-main/client/node-gateway/public/observatory-theme.css"
cp "$DS_DIR/assets/favicon.svg" "$ROOT_DIR/orgs/lab/EHR-LABORG-main/client/node-gateway/public/favicon.svg"
cp "$DS_DIR/assets/logo.svg" "$ROOT_DIR/orgs/lab/EHR-LABORG-main/client/node-gateway/public/logo.svg"

echo "=== CareGrid NITW Design System Sync Complete ==="
