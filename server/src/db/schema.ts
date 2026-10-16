import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
 * A player's city: one JSON document (read and written with parseState) and a version number,
 * +1 on each save, so that two devices saving at once cannot overwrite each other.
 */
export const cities = pgTable("cities", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull(),
  version: integer("version").notNull(),
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
