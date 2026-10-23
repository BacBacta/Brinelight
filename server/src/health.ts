/**
 * Week 8: /health tells the truth. One check catches the three failures that matter online: the database down, the
 * nightly backups stopped, and the weekly test restore failed. The backups and the restores are run outside the server
 * (deploy/backup.sh, deploy/restore.sh); each writes a one-line status file, which the server reads through a
 * read-only folder: only a time and a word, never a dump.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "./db/index.js";

/** The database must answer `select 1` within this time. */
export const DATABASE_LIMIT_MS = 2000;
/** A nightly backup older than this is late: one night missed, with an hour of margin. */
export const BACKUP_LATE_HOURS = 26;
/** The files that backup.sh and restore.sh write in the status folder. */
export const BACKUP_FILE = "backup";
export const RESTORE_FILE = "restore";

export type Health = {
  ok: boolean;
  service: "brinelight";
  version: string;
  database?: "ok" | "down";
  /** "none": no backup has been made yet. */
  backup?: "ok" | "late" | "none";
  /** The last weekly test restore; "none" until the first one, which does not count against `ok`. */
  restore?: "ok" | "failed" | "none";
  /**
   * The notary on Solana (week 9): "off" when there is none, which does not count against `ok`; "late" (a milestone
   * waits for its seal for more than 26 hours), "low" (under 0.005 SOL) or "unlisted" (its address is not in the
   * official list) do.
   */
  notary?: "ok" | "late" | "low" | "unlisted" | "off";
};

/** The database answers a trivial query in time, or it is down. */
export async function databaseUp(db: Db, limitMs = DATABASE_LIMIT_MS): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<false>((resolve) => (timer = setTimeout(() => resolve(false), limitMs)));
  try {
    return await Promise.race([db.execute(sql`select 1`).then(() => true), late]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** A status file's first line, or null if it does not exist. */
async function statusLine(dir: string, file: string): Promise<string | null> {
  try {
    return (await readFile(join(dir, file), "utf8")).split("\n")[0]!.trim();
  } catch {
    return null;
  }
}

/** The last backup: written by backup.sh as the Unix time (seconds) of its last success. */
export async function backupStatus(dir: string, now: Date): Promise<"ok" | "late" | "none"> {
  const line = await statusLine(dir, BACKUP_FILE);
  if (line === null) return "none";
  const at = Number(line);
  if (!Number.isFinite(at) || at <= 0) return "late";
  return now.getTime() - at * 1000 <= BACKUP_LATE_HOURS * 3600 * 1000 ? "ok" : "late";
}

/** The last weekly test restore: written by restore.sh as "ok <time>" or "failed <time>". */
export async function restoreStatus(dir: string): Promise<"ok" | "failed" | "none"> {
  const line = await statusLine(dir, RESTORE_FILE);
  if (line === null) return "none";
  return line.split(/\s+/)[0] === "ok" ? "ok" : "failed";
}

/**
 * The server's health. Without a database (development without one), the database is not checked; without a status
 * folder (development, tests), the backups and the restores are not either.
 */
export async function health(options: {
  db?: Db;
  statusDir: string | null;
  now: Date;
  version: string;
  /** The notary's state; not asked when the database is down. */
  notary?: () => Promise<NonNullable<Health["notary"]>>;
}): Promise<Health> {
  const out: Health = { ok: true, service: "brinelight", version: options.version };
  if (options.db) out.database = (await databaseUp(options.db)) ? "ok" : "down";
  if (options.statusDir) {
    out.backup = await backupStatus(options.statusDir, options.now);
    out.restore = await restoreStatus(options.statusDir);
  }
  if (options.notary && out.database !== "down") out.notary = await options.notary().catch(() => "late" as const);
  out.ok =
    out.database !== "down" &&
    (out.backup === undefined || out.backup === "ok") &&
    out.restore !== "failed" &&
    (out.notary === undefined || out.notary === "ok" || out.notary === "off");
  return out;
}
