import { describe, expect, it } from "vitest";
import { HOUR, newPlayerState, parseState, type PlayerState } from "@brinelight/shared";
import { simulate, type Profile } from "./simulate.js";
import { ISLAND, SETTINGS, mistMargin, study } from "./depletion.js";

const at = (hours: number, minutes = 0) => hours * HOUR + minutes * 60;
const active: Profile = { id: "regular", name: "Active", sessions: [at(8), at(12, 30), at(18), at(22)] };
const [none, soft, , strong] = SETTINGS as [(typeof SETTINGS)[number], (typeof SETTINGS)[number], (typeof SETTINGS)[number], (typeof SETTINGS)[number]];

describe("the study of the island's depletion (docs/studies/depletion.md)", () => {
  it("without depletion, it plays exactly the balance's game: the study's hooks change nothing by themselves", () => {
    const plain = simulate(active, 30);
    const studied = study(none, active, 30);
    expect(studied.run.lighthouse).toEqual(plain.lighthouse);
    expect(studied.run.last.stock).toEqual(plain.last.stock);
  });

  it("the reserves stay between 0 and 1, the production never under the floor, and the cities stay ones the server reads", () => {
    for (const setting of [soft, strong]) {
      const r = study(setting, active, 40);
      for (const d of r.days)
        for (const k of ISLAND) {
          expect(d.reserve[k]).toBeGreaterThanOrEqual(0);
          expect(d.reserve[k]).toBeLessThanOrEqual(1);
          expect(d.output[k]).toBeGreaterThanOrEqual(setting.floor! - 1e-9);
        }
      // The producers' true levels are put back after every step: no fractional level is ever left in the city.
      expect(parseState(JSON.parse(JSON.stringify(r.run.last)))).not.toBeNull();
    }
  });

  it("the Mist's oil at the floor: a Refinery at the Lighthouse's level holds at 60 % and 40 %, not at 25 % without research", () => {
    const city = (refining: number): PlayerState => {
      const s = newPlayerState(0);
      return { ...s, buildings: { ...s.buildings, lighthouse: 12, refinery: 12 }, techs: { refining } };
    };
    expect(mistMargin(0.6, city(0)).held).toBe(true);
    expect(mistMargin(0.4, city(0)).held).toBe(true);
    expect(mistMargin(0.25, city(0)).margin).toBeLessThan(0);
    expect(mistMargin(0.25, city(1)).margin).toBeGreaterThan(0);
  });
});
