#!/bin/bash
# Reusable frontend deploy: extracts a Vite dist tarball over the live dist.
# Usage: ./deploy-dist.sh <app-dir> <tarball>
#   ./deploy-dist.sh customer_website /tmp/customer_dist.tgz
# Build the tarball locally first:
#   tar -czf /tmp/<app>_dist.tgz -C <app> dist && scp /tmp/<app>_dist.tgz ubuntu@SERVER:/tmp/
set -e
APP="$1"; TARBALL="$2"
if [ -z "$APP" ] || [ -z "$TARBALL" ]; then echo "usage: $0 <app-dir> <tarball>"; exit 1; fi
D="/var/www/my-project/$APP/dist"
[ -d "/var/www/my-project/$APP" ] || { echo "ERROR: unknown app dir $APP"; exit 1; }
[ -f "$TARBALL" ] || { echo "ERROR: tarball not found $TARBALL"; exit 1; }
rm -rf "${D:?}/"*
mkdir -p "$D"
tar -xzf "$TARBALL" -C "/var/www/my-project/$APP"
[ -f "$D/index.html" ] || { echo "ERROR: index.html missing after extract"; exit 1; }
echo "deployed $APP OK: $(grep -oE '/assets/index-[^"]+\.js' "$D/index.html" | head -1)"
