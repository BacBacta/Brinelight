import { describe, expect, it } from "vitest";
import { MEASURE_KEY, createMeasure, measureHtml, readMeasures } from "../src/portal/measure.js";
import type { PortalStore } from "../src/portal/store.js";

const memory = () => {
  const m = new Map<string, string>();
  const store: PortalStore = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  return { m, store };
};

describe("?measure: what a session gives, kept on the device only", () => {
  it("counts the session's length, the first move of the beam, the Nights and how they ended", () => {
    const { store } = memory();
    let now = 1_000;
    const m = createMeasure(store, () => now);
    now = 4_200;
    m.beamMoved();
    now = 5_000;
    m.beamMoved();
    m.nightStarted(1);
    now = 80_000;
    m.nightEnded(1, 4, "lost");
    m.nightStarted(1);
    now = 200_000;
    m.nightEnded(1, 5, "won");
    m.save();
    const [s] = readMeasures(store);
    expect(s).toEqual({ start: 1_000, seconds: 199, firstMove: 3.2, nights: [{ night: 1, wave: 4, end: "lost" }, { night: 1, wave: 5, end: "won" }] });
  });

  it("keeps the last 20 sessions, and reads a broken record as none", () => {
    const { m, store } = memory();
    let now = 0;
    for (let i = 0; i < 25; i++) {
      now = i * 1_000_000;
      const s = createMeasure(store, () => now);
      s.save();
    }
    expect(readMeasures(store)).toHaveLength(20);
    m.set(MEASURE_KEY, "{broken");
    expect(readMeasures(store)).toEqual([]);
  });

  it("shows them as a table, a line a session, for the tester to read out", () => {
    const html = measureHtml([{ start: 0, seconds: 754, firstMove: 2.5, nights: [{ night: 1, wave: 4, end: "lost" }, { night: 2, wave: 8, end: "won" }] }]);
    expect(html).toContain("12 min 34 s");
    expect(html).toContain("2.5 s");
    expect(html).toContain("2 Nights");
    expect(html).toContain("Night 2: won");
  });
});
