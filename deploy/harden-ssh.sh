#!/usr/bin/env bash
# Closes SSH to everything but your key, for the user brinelight only. Run with sudo, AFTER checking in a
# second terminal that "ssh brinelight@<server IP>" works with your key (docs/deploy.md, step 4).
set -euo pipefail

USER_NAME=brinelight
CONF=/etc/ssh/sshd_config.d/00-brinelight.conf

if [ "$(id -u)" -ne 0 ]; then
  echo "Run it with sudo: sudo bash $0" >&2
  exit 1
fi
if [ ! -s "/home/$USER_NAME/.ssh/authorized_keys" ]; then
  echo "No SSH key for $USER_NAME: nothing was changed (you would be locked out)." >&2
  exit 1
fi

# Files in sshd_config.d are read first, and the first value read wins: this file takes precedence over others.
cat > "$CONF" <<CONF
# Brinelight: key-only SSH, no root login, only the user $USER_NAME.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers $USER_NAME
CONF

# Never reload a broken configuration.
if ! sshd -t; then
  rm -f "$CONF"
  echo "The SSH configuration test failed: nothing was changed." >&2
  exit 1
fi
systemctl reload ssh

echo "SSH now accepts only your key, for $USER_NAME. The effective settings:"
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|allowusers) '
echo "Keep this terminal open and check, from your computer, that  ssh $USER_NAME@<server IP>  still works."
