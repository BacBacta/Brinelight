# Brinelight's proofs on Solana

Every night, Brinelight's server seals the milestones its players reached in one Solana transaction: a memo with a single fingerprint, the root of a Merkle tree. Each player gets, in the game, what proves that their own milestone is in that root. Anyone can check it, with this page and the chain, without trusting Brinelight.

Nothing personal goes on chain: the root is a hash of hashes, and each leaf has its own random salt, which only its player gets. Nothing is sold, and nothing is ever sent to a player's wallet.

This page is the format's reference. The plan of the week is `docs/tasks/week-9.md`.

## The notary's official addresses

Only these addresses seal Brinelight's proofs. A memo in this format signed by any other address is not ours.

| Network | Address | Seals from | Until |
| --- | --- | --- | --- |
| devnet | `Dr8DjzcGqdE2UReZHfzoN7gkSiYTiinoDw58wb9G522K` ([on the explorer](https://explorer.solana.com/address/Dr8DjzcGqdE2UReZHfzoN7gkSiYTiinoDw58wb9G522K?cluster=devnet)) | 2026-10-23 | (current) |
| mainnet | No notary yet: mainnet waits for the owner's yes (week 9, task 6). | | |

If a key is lost or leaks, a new key is made on the server and its address is added here, and in the game, with the day it starts. The old addresses stay listed with the days they sealed: the proofs they sealed stay checkable. A key that leaked is listed with the day it leaked: what it signs after that day is not ours. The key is never copied off the server.

## The format, version 1

All the hashes are SHA-256. Bytes are written in lowercase hex.

### A leaf

A leaf is the SHA-256 of these bytes, one after the other:

| Bytes | What |
| --- | --- |
| 1 | `0x00`: this is a leaf |
| 19 | the ASCII text `brinelight proof v1` |
| 16 | the salt: random, one per leaf |
| 1 + n | the player's wallet: its length, then its address in base58 (ASCII) |
| 1 + n | the fact: its length, then its text |
| 1 + n | `when`: its length, then `on` or `by` |
| 1 + n | the day: its length, then `YYYY-MM-DD` |

- **The fact** is `<kind>:<value>`: lowercase letters, digits and dashes; the kind starts with a letter and has at most 24 characters, the value at most 32.
  - `lighthouse:<level>`: the Lighthouse reached that level. Only its milestones are proved: 5, 10, 15, 20, 25 and 30.
  - Later kinds, in the same format and the same version: the titles of Guardians of the Great Lighthouse, the seasons of the Tides. A checker that meets a kind it does not know still checks the proof; it just cannot say what the fact means.
- **`when`:**
  - `on`: the day it happened;
  - `by`: on that day at the latest. Used for the milestones passed before the notary existed, dated the day the server first recorded them.
- **The day** is a UTC day.
- The length before each text keeps a field from ever spilling into the next one.

### The tree

- A node is the SHA-256 of `0x01`, then its left child (32 bytes), then its right child (32 bytes). The first byte keeps a leaf from ever passing for a node.
- The leaves keep the order of the seal. Each level pairs its hashes two by two, in order; an odd hash at the end goes up alone, never paired with itself.
- One leaf alone is its own root.
- **A path** is the list of the siblings met from the leaf up to the root, each with its side (`left` or `right` of the hash being built). To check it, start from the leaf and, for each step, hash `0x01 ‖ sibling ‖ hash` when the sibling is on the left, `0x01 ‖ hash ‖ sibling` when it is on the right. The last hash must be the root.

### The seal

One transaction a night, signed by the notary (who pays its fee), with one instruction to Solana's Memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) and this text:

```
brinelight proof v1 <day sealed> <root in hex>
```

For example `brinelight proof v1 2026-10-22 3f…` (64 hex characters). The day sealed is the night's day; each leaf carries its own day.

### The test seal

`npm run notary:test-seal` (run by hand on the server, `docs/deploy.md` step 12) sends one transaction of the same kind on **devnet only**, to check the key, its balance, the transaction and its explorer page:

```
brinelight test v1 <day> 0000000000000000000000000000000000000000000000000000000000000000
```

Its root is fixed (32 zero bytes): it holds no player's data. It is not a seal: nothing of it is recorded by the game, the nightly seals go on as before, and a reader of this format never takes it for one (`brinelight test`, not `brinelight proof`). The command refuses mainnet.

## A leaf worked by hand

The leaf 0 of the test vectors (`shared/test/fixtures/proofs-v1.json`):

| Field | Value | Bytes (hex) |
| --- | --- | --- |
| prefix | | `00` |
| version | `brinelight proof v1` | `6272696e656c696768742070726f6f66207631` |
| salt | | `96e722576f93a1d50bbf4dd9d2a5eb21` |
| wallet | `B8aVvXnqj7JDdPfS7eZbcr1UneNn2hVzfpmHoYKdDmt4` (44 characters) | `2c` then `4238615676586e716a374a446450665337655a62637231556e654e6e3268567a66706d486f594b64446d7434` |
| fact | `lighthouse:5` (12) | `0c` then `6c69676874686f7573653a35` |
| when | `on` (2) | `02` then `6f6e` |
| day | `2026-10-10` (10) | `0a` then `323032362d31302d3130` |

108 bytes in all. Their SHA-256, the leaf, is `735cec9c2d7c02c24a571ad8b32dda75ce047a28e3ffb302427db8e4e3cc9c94`. To redo it on a computer:

```
echo -n "006272696e656c696768742070726f6f6620763196e722576f93a1d50bbf4dd9d2a5eb212c4238615676586e716a374a446450665337655a62637231556e654e6e3268567a66706d486f594b64446d74340c6c69676874686f7573653a35026f6e0a323032362d31302d3130" | xxd -r -p | sha256sum
```

(Without `xxd`: `python3 -c "import sys,binascii;sys.stdout.buffer.write(binascii.unhexlify(sys.argv[1]))" <hex> | sha256sum`.)

The test vectors also hold the roots and paths of trees of 2, 3, 7 and 1,000 leaves. They are frozen: a change in them would be a new version of the format.

## Checking a proof

- **In the game:** Profile → "Your proofs" → **Check**. The browser redoes the leaf and the path, with no server. **See it on Solana** opens the transaction on `explorer.solana.com`: its memo shows the root, and its signer must be the notary's address above.
- **Alone, against the chain:** **Save the proof** gives a small JSON file. Then, in this repository:

  ```
  npm run proof:check -- brinelight-proof-lighthouse-10.json
  ```

  It checks, and says line by line: the leaf and its path lead to the root; the RPC endpoint is on the proof's network (its genesis hash); the transaction is finalized, succeeded, is exactly one Memo instruction with one signer, and its signature is right for its message (checked by the tool, not taken from the endpoint); its memo is this seal; its signer is the notary's official address for that day (this page's list, as `shared/src/rules/notary.ts` holds it). `--rpc https://…` uses another endpoint.

## The RPC endpoints, and when to move to a provider

The server and `proof:check` use Solana's free public endpoints: `api.devnet.solana.com` on devnet; `api.mainnet-beta.solana.com`, then `solana-rpc.publicnode.com`, on mainnet. A call that fails is tried 4 times in all, 1, 3 and 9 seconds apart, on the next endpoint; the seal is looked at again every 5 minutes, so a night is never lost to an endpoint down for a while.

Move to a provider (Helius, QuickNode, Triton… a free plan is enough for one transaction a night) **if, in a week, the server's log says "The seal could not be sent yet" or "The seal's look failed" on 3 nights or more**, or if `/health` says `late`. How: make an account, take its https address, add `SOLANA_RPC_URLS=<that address>` to `deploy/.env` (it holds the provider's key: same care as the notary's), then `docker compose up -d`. The log shows only the provider's host, never its address.

## The transaction, exactly

One legacy transaction of about 264 bytes (the limit is 1,232):

- one signature, the notary's;
- the header `[1, 0, 1]`: one signer (the notary, who pays the fee and may be debited), no read-only signer, one read-only account that does not sign (the Memo program);
- two accounts: the notary, then the Memo program;
- a recent blockhash, finalized: the transaction can only land within about a minute of it;
- one instruction to the Memo program, naming no account, carrying the memo's text.

It moves no SOL (only the fee is paid: 5,000 lamports, no priority fee), creates no account, and names no other program. Checked against Solana's documented format, against a transaction built by Solana's own SDK (`server/test/fixtures/memo-tx-solders.json`), and by a devnet node, which verified its signature (week 9).

## Liste de vérifications avant mainnet (pour le propriétaire, en français)

À faire toi-même, dans l'ordre. Chaque ligne se coche par un oui. Si une réponse est non, on s'arrête et on en parle.

**La clé**

1. Sur le serveur, `./notary-key.sh devnet` a affiché une adresse, et rien d'autre de long ni de secret.
2. Le relancer répond « A devnet key is already in deploy/secrets/notary-devnet.key: nothing was changed. »
3. `ls -l ~/brinelight/deploy/secrets/` montre `notary-devnet.key` en `-rw-------` et au nom de `brinelight` (lisible par toi seul).
4. `grep -c NOTARY_KEY ~/brinelight/deploy/.env` répond `0` : aucune clé dans `.env`.
5. `docker inspect brinelight-server-1 | grep -cFf ~/brinelight/deploy/secrets/notary-devnet.key` répond `0` : Docker ne montre pas la clé. (`grep` lit la clé dans son fichier sans l'afficher ; tape la commande telle quelle.)
6. Tu n'as jamais ouvert le fichier de clé pour la regarder, ni copié `deploy/secrets/` hors du serveur, ni collé son contenu nulle part (ni dans une conversation, ni dans GitHub).
7. Dans GitHub, le dépôt ne contient dans `deploy/secrets/` que `README.md`.

**Le réseau**

8. `.env` contient `SOLANA_CLUSTER=devnet`, et `deploy/secrets/notary-mainnet.key` est vide (`ls -l` montre une taille de 0).
9. Le journal du serveur (`docker compose logs server | grep -i notary`) dit `"cluster":"devnet"` et l'adresse de l'étape 1.
10. Sur `explorer.solana.com`, l'adresse du notaire n'existe que sur **Devnet** (le sélecteur en haut à droite) : sur **Mainnet Beta**, elle est vide.

**Le sceau de test**

11. `docker compose exec server npm run notary:test-seal` : toutes les lignes commencent par ✓, et la page « See it » montre un seul signataire (l'adresse du notaire), « Memo Program », le texte `brinelight test v1 <jour> 000…0` et des frais de 0.000005 SOL.

**Le sceau**

12. Le lendemain d'un palier, après 00:15 UTC : sur la page de l'adresse (devnet), **une seule** transaction `brinelight proof` pour cette nuit (celles en `brinelight test` sont tes sceaux de test).
13. En l'ouvrant : un seul signataire (l'adresse du notaire), un seul programme (« Memo Program »), un texte `brinelight proof v1 <jour> <64 caractères>`, des frais de 0.000005 SOL, et aucun transfert de SOL.
14. Le solde de l'adresse n'a baissé que de 0.000005 SOL par nuit scellée et par sceau de test.
15. Dans le jeu, Profil → « Your proofs » : ton palier dit « Sealed on Solana », et **Check** répond « This proof matches the seal. »
16. « Save the proof », puis le fichier envoyé à Claude Code : `npm run proof:check` répond « This proof holds. »
17. `curl -s https://api.brinelight.xyz/health` dit `"notary":"ok"`.

**Les pannes**

18. Le serveur redémarré (`docker compose restart server`) pendant la journée : la nuit suivante, toujours une seule transaction.
19. L'alerte : si le notaire n'a plus assez de SOL ou si un sceau a plus de 26 heures de retard, GitHub t'envoie un e-mail (le workflow watch).

**La relecture**

20. La relecture indépendante de la semaine 9 a été faite, et ce qu'elle a trouvé est corrigé (`docs/tasks/week-9.md`).
21. Avant les paiements USDC (semaine 14) : une relecture par un développeur Solana humain, obligatoire (`docs/decisions.md`).

Alors seulement : ton accord pour mainnet (tâche 6).
