import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/** A player: one per Solana wallet. */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
});

/** A signed-in session. Only the SHA-256 hash of the token is stored, never the token itself. */
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_player_idx").on(t.playerId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** Single-use sign-in nonces. */
export const authNonces = pgTable(
  "auth_nonces",
  {
    nonce: text("nonce").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    /** The "Issued At" the server gives with the nonce; the signed message must carry exactly this time. */
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("auth_nonces_expires_idx").on(t.expiresAt)],
);

/**
 * A player's city: one JSON document (read with migrateCity, written with parseState) and a version number,
 * +1 on each save, so that two devices saving at once cannot overwrite each other. `shape` is the shape of the
 * document (CITY_SHAPE when written today): a city stored in an older shape is brought up to date when it is read,
 * and written in the current shape at its next change. Rows stored before the column existed are shape 4.
 */
export const cities = pgTable("cities", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull(),
  version: integer("version").notNull(),
  shape: integer("shape").notNull().default(4),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull(),
});

/**
 * The actions a player's city received, by the id the client gave them, so none is ever applied twice.
 * Never the city: only the outcome (applied, or refused with its code and reason) and a SHA-256 of the action,
 * so the same id sent with other content can be told apart. Kept 7 days.
 */
export const appliedActions = pgTable(
  "applied_actions",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    actionId: uuid("action_id").notNull(),
    actionHash: text("action_hash").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull(),
    ok: boolean("ok").notNull(),
    code: text("code"),
    error: text("error"),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.actionId] }), index("applied_actions_at_idx").on(t.appliedAt)],
);

/**
 * The nightly seals on Solana (week 9, task 4): one Memo transaction a night per network. Everything here is public
 * (the root, the memo, the signed transaction): never the key. A seal is written, with its signed transaction, before
 * it is sent; `status` is `sent`, then `finalized`, or `expired` (its blockhash passed: it can never land) or `failed`
 * (it landed with an error). At most one seal of a night is `sent` or `finalized`, enforced by the database.
 */
export const seals = pgTable(
  "seals",
  {
    id: serial("id").primaryKey(),
    cluster: text("cluster").notNull(),
    day: text("day").notNull(),
    root: text("root").notNull(),
    memo: text("memo").notNull(),
    leaves: integer("leaves").notNull(),
    /**
     * The seal's leaves (hex, 64 characters each), in their order: the tree is kept whole with the seal, so a proof's
     * path never depends on other players' rows (a player deleted leaves the others' proofs as they were).
     */
    leafHashes: text("leaf_hashes").notNull(),
    signer: text("signer").notNull(),
    signature: text("signature").notNull().unique(),
    /** The signed transaction, in base64: sent again as it is (same signature) until it lands or expires. */
    tx: text("tx").notNull(),
    lastValidHeight: bigint("last_valid_height", { mode: "number" }).notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("seals_one_a_night").on(t.cluster, t.day).where(sql`status in ('sent', 'finalized')`)],
);

/**
 * The facts of a player's game to be sealed on Solana (week 9, `docs/proofs.md`): today the Lighthouse's milestones.
 * Each row keeps what its player needs to check it: the fact, `on` or `by` its day, the salt (hex, random, the only
 * thing that ties the leaf to the player) and the leaf (hex). Never the wallet: the leaf already holds it, hashed.
 * A fact is recorded once per player; a player deleted takes their rows with them, and their leaves can then be tied
 * to no one.
 */
export const proofs = pgTable(
  "proofs",
  {
    id: serial("id").primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    fact: text("fact").notNull(),
    /** `on` or `by` (`when` is a word of SQL). */
    when: text("dated").notNull(),
    day: text("day").notNull(),
    salt: text("salt").notNull(),
    leaf: text("leaf").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    /** The seal it went into, and its place among that seal's leaves; empty until then. */
    sealId: integer("seal_id").references(() => seals.id, { onDelete: "set null" }),
    position: integer("position"),
  },
  (t) => [unique("proofs_player_fact").on(t.playerId, t.fact), index("proofs_seal_idx").on(t.sealId)],
);
