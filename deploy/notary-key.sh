#!/usr/bin/env bash
# Makes the notary's key for one Solana network and writes it into deploy/secrets/notary-<network>.key, a file of its
# own that Docker Compose mounts read-only in the game server's container only (docs/deploy.md, "The notary on
# Solana"). It shows only the key's public address. It never replaces a key already there.
# Run as brinelight on the server:  ~/brinelight/deploy/notary-key.sh devnet   (mainnet only with the owner's yes)
set -euo pipefail
# Never traced, even if run with bash -x: a trace would print the key.
set +x

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

cluster="${1:-}"
case "$cluster" in
  devnet | mainnet) ;;
  *)
    echo "Say which network: ./notary-key.sh devnet   (or mainnet)" >&2
    exit 2
    ;;
esac
file="secrets/notary-$cluster.key"

# The game server runs as the user 1000 in its container: the key file must be theirs, mode 600, to be read there.
server_uid="${SERVER_UID:-1000}"
if [ "$(id -u)" != "$server_uid" ]; then
  echo "Run this as the user whose id is $server_uid (brinelight on the server): the game server reads the key as that user." >&2
  exit 1
fi
if [ -s "$file" ]; then
  echo "A $cluster key is already in deploy/$file: nothing was changed." >&2
  echo "A key is never replaced by this script. If it is lost or leaked, read docs/deploy.md first." >&2
  exit 1
fi

# Everything this script writes is readable by its owner only.
umask 077
mkdir -p secrets
chmod 700 secrets

# The key is made by Node in a throwaway container of the server's image (Node is not installed on the machine): no
# network, no settings, and no Docker log (the default log would write the container's output to disk).
# Its two lines come back here, into a variable, never onto the screen.
if ! out="$(docker run --rm --network none --log-driver none --workdir /app/server brinelight-server node --import tsx src/proofs/keygen.ts)"; then
  echo "The key could not be made: is the server built (docker compose build server)?" >&2
  exit 1
fi
# Read with bash alone: the key goes through no other program and no temporary file.
first="${out%%$'\n'*}"
second="${out#*$'\n'}"
second="${second%$'\n'}"
unset out
address=""
secret=""
if [[ "$first" =~ ^address\ ([1-9A-HJ-NP-Za-km-z]{32,44})$ ]]; then address="${BASH_REMATCH[1]}"; fi
if [[ "$second" =~ ^secret\ ([1-9A-HJ-NP-Za-km-z]{80,90})$ ]]; then secret="${BASH_REMATCH[1]}"; fi
unset first second BASH_REMATCH
if [ -z "$address" ] || [ -z "$secret" ]; then
  unset secret
  echo "The key could not be made: unexpected answer from the container (nothing was written)." >&2
  exit 1
fi

# Written beside the file, then put in its place in one step: a stop half-way leaves no half key.
# printf is part of bash: the key never appears in the list of running commands.
printf '%s\n' "$secret" > "$file.new"
unset secret
chmod 600 "$file.new"
mv "$file.new" "$file"

echo "The $cluster notary's key is in deploy/$file (yours only, mode 600; never copy it anywhere)."
echo "Its public address (you can share it): $address"
