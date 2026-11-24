/**
 * ?measure (Hold the Light, gates A and B): what each session gives, counted on the device only and never sent. The
 * tester reads it out from the page `?measure` shows: the session's length, the beam's first move, the Nights.
 */
import type { PortalStore } from "./store.js";

export const MEASURE_KEY = "hold-the-light-measure";
const KEEP = 20;

export type NightRecord = { night: number; wave: number; end: "won" | "lost" };
export type SessionRecord = { start: number; seconds: number; firstMove: number | null; nights: NightRecord[] };

export function readMeasures(store: PortalStore | null): SessionRecord[] {
  try {
    const all: unknown = JSON.parse(store?.getItem(MEASURE_KEY) ?? "[]");
    return Array.isArray(all) ? (all as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

/** This session's counter: it rewrites its own line each time it is saved. `now` is in milliseconds. */
export function createMeasure(store: PortalStore | null, now: () => number) {
  const me: SessionRecord = { start: now(), seconds: 0, firstMove: null, nights: [] };
  return {
    beamMoved() {
      if (me.firstMove === null) me.firstMove = Math.round((now() - me.start) / 100) / 10;
    },
    nightStarted(_night: number) {
      // Counted when it ends: a Night left in the middle shows as the session's length.
    },
    nightEnded(night: number, wave: number, end: "won" | "lost") {
      me.nights.push({ night, wave, end });
    },
    save() {
      me.seconds = Math.round((now() - me.start) / 1000);
      try {
        const others = readMeasures(store).filter((s) => s.start !== me.start);
        store?.setItem(MEASURE_KEY, JSON.stringify([...others, me].slice(-KEEP)));
      } catch {
        // Nowhere to keep it: nothing is measured.
      }
    },
  };
}

const duration = (s: number): string => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

/** The sessions, a line each, newest first. */
export function measureHtml(sessions: readonly SessionRecord[]): string {
  if (sessions.length === 0) return "<p>No session measured on this device yet.</p>";
  const rows = [...sessions].reverse().map(
    (s, i) =>
      `<li><b>Session ${sessions.length - i}: ${duration(s.seconds)}</b> · beam first moved after ${s.firstMove === null ? "–" : `${s.firstMove} s`} · ${s.nights.length} Night${s.nights.length === 1 ? "" : "s"}` +
      (s.nights.length ? `<br><small>${s.nights.map((n) => `Night ${n.night}: ${n.end} at wave ${n.wave}`).join(" · ")}</small>` : "") +
      `</li>`,
  );
  return `<ol class="measures">${rows.join("")}</ol>`;
}
