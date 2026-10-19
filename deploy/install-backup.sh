#!/usr/bin/env bash
# Installs the nightly backup and the weekly test restore (two systemd timers). Run once, with sudo:  sudo ./install-backup.sh
# Running it again after an update is safe: it rewrites the same units.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run it with sudo: sudo $0" >&2
  exit 1
fi
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

for unit in brinelight-backup brinelight-restore-test; do
  sed "s#__DEPLOY_DIR__#$DEPLOY_DIR#" "$DEPLOY_DIR/systemd/$unit.service" > "/etc/systemd/system/$unit.service"
  cp "$DEPLOY_DIR/systemd/$unit.timer" "/etc/systemd/system/$unit.timer"
done
systemctl daemon-reload
systemctl enable --now brinelight-backup.timer brinelight-restore-test.timer

echo "Nightly backup and weekly test restore installed. Next runs:"
systemctl list-timers brinelight-backup.timer brinelight-restore-test.timer --no-pager
