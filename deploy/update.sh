#!/usr/bin/env bash
# Puts the latest version of the main branch online (docs/deploy.md, "Update the game").
# Run as brinelight, from anywhere:  ~/brinelight/deploy/update.sh
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

echo "1/4 Backup before the update"
sudo "$DEPLOY_DIR/backup.sh"

echo "2/4 Latest version of main"
git -C "$DEPLOY_DIR/.." fetch origin main
git -C "$DEPLOY_DIR/.." merge --ff-only origin/main

echo "3/4 Build and restart (database migrations apply by themselves at start)"
docker compose up -d --build

echo "4/4 Check"
api_domain="$(grep -E '^API_DOMAIN=' .env | cut -d= -f2-)"
for _ in $(seq 1 30); do
  if curl -fsS "https://$api_domain/health" > /dev/null 2>&1; then
    echo "Online: https://$api_domain/health answers."
    exit 0
  fi
  sleep 2
done
echo "The server does not answer yet. Look at the logs: docker compose logs --tail 50 server" >&2
exit 1
