#!/usr/bin/env bash
# Deploys a commit (default: develop) to the preproduction CMS on the OVH VPS.
#
# The commit is exported with `git archive` and built locally with Node 22, so
# uncommitted files and the local .env never reach the server. On the VPS only
# the `dependant-preprod` PM2 process is reloaded; .env.preprod, node_modules
# and public/uploads are left in place, and production is not touched.
#
# Usage: scripts/deploy-preprod.sh [git-ref]
set -euo pipefail

REF=${1:-develop}
VPS=${PREPROD_VPS:-ubuntu@51.222.156.38}
REMOTE_DIR=/home/ubuntu/dependantCMS-preprod
REMOTE_NODE_DIR=/home/ubuntu/.local/opt/dependant-preprod-node22/bin
BUILD_DIR=${PREPROD_BUILD_DIR:-${TMPDIR:-/tmp}/dependantCMS-preprod-build}
HEALTH_URL=https://cms-preprod.dependant.tv/_health

cd "$(git rev-parse --show-toplevel)"
COMMIT=$(git rev-parse --verify "$REF^{commit}")
[ -z "$(git status --porcelain)" ] || echo "Note: uncommitted changes are not deployed."

NODE_DIR=${PREPROD_BUILD_NODE_DIR:-$(ls -d "$HOME"/.nvm/versions/node/v22.*/bin 2>/dev/null | tail -1 || true)}
if [ ! -x "$NODE_DIR/node" ]; then
  echo "Node 22 not found; set PREPROD_BUILD_NODE_DIR to its bin directory." >&2
  exit 1
fi
export PATH="$NODE_DIR:$PATH"

echo "Building $REF ($COMMIT) in $BUILD_DIR"
mkdir -p "$BUILD_DIR"
find "$BUILD_DIR" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
git archive "$COMMIT" | tar -x -C "$BUILD_DIR"
cd "$BUILD_DIR"

LOCK_SHA=$(shasum -a 256 package-lock.json | cut -d' ' -f1)
if [ "$(cat node_modules/.lock-sha 2>/dev/null || true)" != "$LOCK_SHA" ]; then
  npm ci
  echo "$LOCK_SHA" > node_modules/.lock-sha
fi

PUBLIC_URL=https://cms-preprod.dependant.tv \
UPLOAD_PROVIDER=local \
MUX_UPLOADS_ENABLED=false \
STRAPI_TELEMETRY_DISABLED=true \
  npm run build

REMOTE_LOCK_SHA=$(ssh "$VPS" "sha256sum $REMOTE_DIR/package-lock.json | cut -d' ' -f1")

echo "Uploading to $VPS:$REMOTE_DIR"
rsync -az --delete dist/ "$VPS:$REMOTE_DIR/dist/"
rsync -az --exclude public/uploads \
  config database public src types \
  package.json package-lock.json tsconfig.json favicon.png \
  ecosystem.preprod.config.cjs .env.preprod.example \
  "$VPS:$REMOTE_DIR/"

# Linux dependencies are installed on the VPS itself, only when the lockfile
# changed.
ssh "$VPS" bash -s <<EOF
set -euo pipefail
cd $REMOTE_DIR
if [ "$REMOTE_LOCK_SHA" != "$LOCK_SHA" ]; then
  PATH=$REMOTE_NODE_DIR:\$PATH npm ci
fi
echo "$COMMIT" > REVISION
PREPROD_NODE_PATH=$REMOTE_NODE_DIR/node \
  pm2 startOrReload ecosystem.preprod.config.cjs --only dependant-preprod --update-env
EOF

for _ in $(seq 1 45); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL")" = 204 ]; then
    echo "Preproduction CMS is up on $COMMIT"
    exit 0
  fi
  sleep 2
done
echo "Health check failed: $HEALTH_URL" >&2
exit 1
