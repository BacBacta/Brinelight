#!/usr/bin/env bash
# Installs the nightly backup (a systemd timer). Run once, with sudo:  sudo ./install-backup.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run it with sudo: sudo $0" >&2
  exit 1
fi
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

sed "s#__DEPLOY_DIR__#$DEPLOY_DIR#" "$DEPLOY_DIR/systemd/brinelight-backup.service" > /etc/systemd/system/brinelight-backup.service
cp "$DEPLOY_DIR/systemd/brinelight-backup.timer" /etc/systemd/system/brinelight-backup.timer
systemctl daemon-reload
systemctl enable --now brinelight-backup.timer

echo "Nightly backup installed. Next run:"
systemctl list-timers brinelight-backup.timer --no-pager
