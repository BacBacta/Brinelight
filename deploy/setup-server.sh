#!/usr/bin/env bash
# Prepares a new Ubuntu 24.04 server for Brinelight. Run ONCE, as root, right after creating the server:
#   bash setup-server.sh
# It does not close the root login nor passwords: harden-ssh.sh does that, once you have checked that
# your key works for the user brinelight (docs/deploy.md, step 4). That way you cannot lock yourself out.
set -euo pipefail

USER_NAME=brinelight

say() { printf '\n==> %s\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root." >&2
  exit 1
fi
# shellcheck source=/dev/null
. /etc/os-release
if [ "${ID:-}" != "ubuntu" ] || [ "${VERSION_ID:-}" != "24.04" ]; then
  echo "This script is written for Ubuntu 24.04 (found: ${PRETTY_NAME:-unknown})." >&2
  exit 1
fi
if [ ! -s /root/.ssh/authorized_keys ]; then
  echo "No SSH key found for root (/root/.ssh/authorized_keys). Add your public key when creating the server." >&2
  exit 1
fi

say "System updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get -y install ca-certificates curl git ufw unattended-upgrades

say "User $USER_NAME, with your SSH key"
if ! id "$USER_NAME" > /dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$USER_NAME"
fi
usermod -aG sudo "$USER_NAME"
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
install -m 600 -o "$USER_NAME" -g "$USER_NAME" /root/.ssh/authorized_keys "/home/$USER_NAME/.ssh/authorized_keys"
echo "Choose a password for $USER_NAME. It is asked only by sudo; SSH will accept your key only."
passwd "$USER_NAME"

say "Docker, from Docker's own package repository"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# Members of the docker group can run containers without sudo (and so act as root through Docker).
usermod -aG docker "$USER_NAME"

say "Firewall: only SSH (rate-limited), HTTP and HTTPS"
ufw default deny incoming
ufw default allow outgoing
# "limit": more than 6 connection attempts in 30 seconds from one address are refused for a while.
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
ufw status verbose

say "Automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
systemctl enable --now unattended-upgrades

say "Clock (sign-in refuses a gap of more than 5 minutes)"
timedatectl set-timezone UTC
timedatectl set-ntp true
timedatectl status | grep -E "Time zone|synchronized|NTP service"

say "Done"
echo "Now, from YOUR computer, in a new terminal, check that this works:  ssh $USER_NAME@<server IP>"
echo "Then, on the server as $USER_NAME:  sudo bash ~/harden-ssh.sh   (docs/deploy.md, step 4)"
