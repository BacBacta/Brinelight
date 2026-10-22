#!/usr/bin/env bash
# Makes the notary's key for one Solana network and writes it into deploy/.env (docs/deploy.md, "The notary on
# Solana"). It shows only the key's public address. It never replaces a key already there.
# Run as brinelight on the server:  ~/brinelight/deploy/notary-key.sh devnet   (mainnet only with the owner's yes)
set -euo pipefail
# Never traced, even if run with bash -x: a trace would print the key.
set +x

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DEPLOY_DIR"

cluster="${1:-}"
case "$cluster" in
  devnet) var=NOTARY_KEY_DEVNET ;;
  mainnet) var=NOTARY_KEY_MAINNET ;;
  *)
    echo "Say which network: ./notary-key.sh devnet   (or mainnet)" >&2
    exit 2
    ;;
esac

if [ ! -f .env ]; then
  echo "deploy/.env is missing: the server is not installed here (docs/deploy.md)." >&2
  exit 1
fi
if grep -qE "^${var}=.+" .env; then
  echo "A $cluster key is already in deploy/.env ($var): nothing was changed." >&2
  echo "A key is never replaced by this script. If it is lost or leaked, read docs/deploy.md first." >&2
  exit 1
fi

# Everything this script writes is readable by its owner only.
umask 077

# The key is made by Node in a throwaway container of the server's image (Node is not installed on the machine): no
# network, no settings from .env, and no Docker log (the default log would write the container's output to disk).
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

# Readable by its owner only, before the key goes in.
chmod 600 .env
# An empty "$var=" line (from .env.example) is taken out first, so the file holds one line for it. The new file
# replaces the old one in one step: a stop half-way leaves the old one whole.
if grep -qE "^${var}=$" .env; then
  { grep -vE "^${var}=$" .env || true; } > .env.new
  chmod 600 .env.new
  mv .env.new .env
fi
# A last line without its end of line would glue the key onto it.
if [ -s .env ] && [ "$(tail -c 1 .env)" != "" ]; then echo >> .env; fi
# printf is part of bash: the key never appears in the list of running commands.
printf '%s=%s\n' "$var" "$secret" >> .env
unset secret

echo "The $cluster notary's key is in deploy/.env ($var)."
echo "Its public address (you can share it): $address"
