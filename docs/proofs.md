# Brinelight's proofs on Solana

Every night, Brinelight's server seals the milestones its players reached in one Solana transaction: a memo with a single fingerprint, the root of a Merkle tree. Each player gets, in the game, what proves that their own milestone is in that root. Anyone can check it, with this page and the chain, without trusting Brinelight.

Nothing personal goes on chain: the root is a hash of hashes, and each leaf has its own random salt, which only its player gets. Nothing is sold, and nothing is ever sent to a player's wallet.

This page is the format's reference. The plan of the week is `docs/tasks/week-9.md`.

## The notary's official addresses

Only these addresses seal Brinelight's proofs. A memo in this format signed by any other address is not ours.

| Network | Address | Seals from | Until |
| --- | --- | --- | --- |
| — | No notary yet: the first key is made in task 3 of week 9. | | |

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
