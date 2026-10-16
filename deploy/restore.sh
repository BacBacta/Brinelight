#!/usr/bin/env bash
# Restore the database from a backup (docs/deploy.md, "Backups").
#
#   ./restore.sh test [file]     Restores into a separate, temporary database and compares it with the live one.
#                                Nothing is changed. Without a file, the latest backup is used.
#   ./restore.sh replace <file>  Replaces the live database with the backup. Asks you to type the file name first.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/brinelight}"
cd "$DEPLOY_DIR"

psql_db() { docker compose exec -T -e PGOPTIONS=--client-min-messages=warning db psql -U brinelight -d "$1" -v ON_ERROR_STOP=1 -qtA -c "$2"; }
counts() { psql_db "$1" "select (select count(*) from players) || ' players, ' || (select count(*) from cities) || ' cities'"; }

mode="${1:-}"
file="${2:-}"
if [ -z "$file" ] && [ "$mode" = "test" ]; then
  # shellcheck disable=SC2012 # our own file names, no spaces
  file="$(ls -1t "$BACKUP_DIR"/brinelight-*.dump 2>/dev/null | head -n 1 || true)"
fi
if [ -z "$mode" ] || [ -z "$file" ] || [ ! -s "$file" ]; then
  echo "Usage: $0 test [file]   or   $0 replace <file>" >&2
  echo "Backups in $BACKUP_DIR:" >&2
  ls -1t "$BACKUP_DIR" 2>/dev/null >&2 || true
  exit 1
fi

case "$mode" in
  test)
    echo "Test restore of $file into the database brinelight_restore_test..."
    psql_db brinelight "drop database if exists brinelight_restore_test" > /dev/null
    psql_db brinelight "create database brinelight_restore_test" > /dev/null
    docker compose exec -T db pg_restore -U brinelight -d brinelight_restore_test --no-owner --exit-on-error < "$file"
    echo "In the backup:   $(counts brinelight_restore_test)"
    echo "Live right now:  $(counts brinelight)"
    psql_db brinelight "drop database brinelight_restore_test" > /dev/null
    echo "Test restore OK. The temporary database was deleted; the live database was not touched."
    ;;
  replace)
    echo "This REPLACES the live database with: $file"
    echo "Everything saved since that backup will be lost. A backup of the current database is made first."
    read -r -p "Type the file name (just the name, like $(basename "$file")) to go on: " answer
    if [ "$answer" != "$(basename "$file")" ]; then
      echo "Not the same name: nothing was changed." >&2
      exit 1
    fi
    "$DEPLOY_DIR/backup.sh"
    docker compose stop server
    psql_db postgres "drop database brinelight with (force)" > /dev/null
    psql_db postgres "create database brinelight owner brinelight" > /dev/null
    docker compose exec -T db pg_restore -U brinelight -d brinelight --no-owner --exit-on-error < "$file"
    docker compose start server
    echo "Restored: $(counts brinelight)"
    ;;
  *)
    echo "Unknown mode \"$mode\": use test or replace." >&2
    exit 1
    ;;
esac
