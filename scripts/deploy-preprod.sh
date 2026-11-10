#!/usr/bin/env bash
# Deploys a commit (default: develop) to the preproduction CMS on the OVH VPS.
# GitHub Actions runs it on every push to develop
# (.github/workflows/deploy-preprod.yml); it can also be run from a Mac.
#
# The commit is exported with `git archive` and built with Node 22 outside the
# VPS, so uncommitted files and the local .env never reach the server. The
# build is installed by scripts/preprod-receive.sh on the VPS, which reloads
# only the `dependant-preprod` PM2 process; .env.preprod, node_modules and
# public/uploads are left in place, and production is not touched.
#
# Usage: scripts/deploy-preprod.sh [git-ref]
set -euo pipefail

REF=${1:-develop}
VPS=${PREPROD_VPS:-ubuntu@51.222.156.38}
RECEIVE=/home/ubuntu/.local/bin/dependant-preprod-receive
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

# The file list matches SOURCES in scripts/preprod-receive.sh, which refuses an
# archive missing one of them. COPYFILE_DISABLE and --no-xattrs keep macOS
# metadata out of the archive.
echo "Sending to $VPS"
COPYFILE_DISABLE=1 tar --no-xattrs -czf - --exclude public/uploads \
  dist config database public src types \
  package.json package-lock.json tsconfig.json favicon.png \
  ecosystem.preprod.config.cjs .env.preprod.example |
  ssh "$VPS" "$RECEIVE" "$COMMIT"

for _ in $(seq 1 45); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL")" = 204 ]; then
    echo "Preproduction CMS answers on $HEALTH_URL"
    exit 0
  fi
  sleep 2
done
echo "Health check failed: $HEALTH_URL" >&2
exit 1
