#!/usr/bin/env bash
# Nightly backup of the database (run by the brinelight-backup timer, see docs/deploy.md).
# Writes /var/backups/brinelight/brinelight-<date>.dump and keeps the last 7 days.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/brinelight}"
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cd "$DEPLOY_DIR"

name="brinelight-$(date -u +%Y-%m-%d-%H%M%S).dump"
tmp="$BACKUP_DIR/.$name.part"
trap 'rm -f "$tmp"' EXIT

# pg_dump in the database container; custom format (-Fc): compressed, restored with pg_restore.
docker compose exec -T db pg_dump -U brinelight -d brinelight -Fc > "$tmp"

# An empty or unreadable dump is an error, never a backup.
if [ ! -s "$tmp" ]; then
  echo "Backup failed: the dump is empty." >&2
  exit 1
fi
if ! docker compose exec -T db pg_restore --list < "$tmp" > /dev/null; then
  echo "Backup failed: the dump cannot be read back." >&2
  exit 1
fi

chmod 600 "$tmp"
mv "$tmp" "$BACKUP_DIR/$name"
trap - EXIT

# Keep the last 7 days: delete dumps 7 days old or more.
find "$BACKUP_DIR" -maxdepth 1 -name 'brinelight-*.dump' -mtime +$((KEEP_DAYS - 1)) -delete

echo "Backup written: $BACKUP_DIR/$name ($(du -h "$BACKUP_DIR/$name" | cut -f1))"
