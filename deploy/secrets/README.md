# deploy/secrets

The notary's keys, one file per Solana network, on the server only (docs/deploy.md, step 12):

- `notary-devnet.key`
- `notary-mainnet.key` (only with the owner's yes)

Made by `deploy/notary-key.sh`, which shows only the public address. Each file belongs to `brinelight` (the user 1000), mode 600, and is mounted read-only in the game server's container alone, as a Docker Compose secret. Empty until there is a key: `update.sh` makes the empty files Docker Compose needs.

Everything here but this README is ignored by git. Never copy these files off the server, never paste them anywhere.
