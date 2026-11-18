#!/usr/bin/env bash
# Installs a preproduction CMS build on the OVH VPS. It runs on the VPS, as
# /home/ubuntu/.local/bin/dependant-preprod-receive; copy it there again after
# changing it (dependant.tv docs/preproduction.md).
#
# Reads on stdin a gzipped tar of the compiled admin (dist) and the sources,
# sent by scripts/deploy-preprod.sh or .github/workflows/deploy-preprod.yml,
# and takes the deployed commit as its only argument. It is also the forced
# command of the GitHub Actions SSH key, so that key can run nothing else; the
# command line it asked for then arrives in SSH_ORIGINAL_COMMAND, and only its
# last word, the commit, is used.
#
# Only the dependant-preprod PM2 process is reloaded. .env.preprod,
# node_modules and public/uploads stay in place, and production is not touched.
set -euo pipefail

REMOTE_DIR=/home/ubuntu/dependantCMS-preprod
NODE_DIR=/home/ubuntu/.local/opt/dependant-preprod-node22/bin
HEALTH_URL=http://127.0.0.1:1338/_health
SOURCES=(config database public src types package.json package-lock.json
  tsconfig.json favicon.png ecosystem.preprod.config.cjs .env.preprod.example)

REQUESTED=${SSH_ORIGINAL_COMMAND:-}
COMMIT=${1:-${REQUESTED##* }}
if [[ ! $COMMIT =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: dependant-preprod-receive <full commit sha> < build.tar.gz" >&2
  exit 2
fi

# One deployment at a time, whether manual or from GitHub.
exec 9>"$HOME/.dependant-preprod-deploy.lock"
flock -w 900 9

STAGE=$(mktemp -d "$HOME/.dependant-preprod-stage.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT
tar -xzf - -C "$STAGE" --no-same-owner
for item in dist "${SOURCES[@]}"; do
  if [ ! -e "$STAGE/$item" ]; then
    echo "The archive has no $item; nothing was changed." >&2
    exit 3
  fi
done

OLD_LOCK_SHA=$(sha256sum "$REMOTE_DIR/package-lock.json" | cut -d' ' -f1)
rsync -a --delete "$STAGE/dist/" "$REMOTE_DIR/dist/"
(cd "$STAGE" && rsync -a --exclude public/uploads "${SOURCES[@]}" "$REMOTE_DIR/")

cd "$REMOTE_DIR"
# Linux dependencies are installed here, only when the lockfile changed.
if [ "$(sha256sum package-lock.json | cut -d' ' -f1)" != "$OLD_LOCK_SHA" ]; then
  PATH=$NODE_DIR:$PATH npm ci
fi
echo "$COMMIT" > REVISION
PREPROD_NODE_PATH=$NODE_DIR/node \
  pm2 startOrReload ecosystem.preprod.config.cjs --only dependant-preprod --update-env

for _ in $(seq 1 45); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL")" = 204 ]; then
    echo "Preproduction CMS is up on $COMMIT"
    exit 0
  fi
  sleep 2
done
echo "Health check failed: $HEALTH_URL" >&2
exit 1
