/**
 * npm run balance: plays the three profiles for 60 days and writes docs/balance/days.csv, docs/balance/lighthouse.svg
 * and the tables of docs/balance.md (between its markers). It changes no value of the rules.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { simulateAll } from "./simulate.js";
import { DAYS, toCsv, toSvg, withTables } from "./report.js";

const docs = fileURLToPath(new URL("../../docs/", import.meta.url));
const runs = simulateAll(DAYS);
mkdirSync(`${docs}balance`, { recursive: true });
writeFileSync(`${docs}balance/days.csv`, toCsv(runs));
writeFileSync(`${docs}balance/lighthouse.svg`, toSvg(runs));
writeFileSync(`${docs}balance.md`, withTables(readFileSync(`${docs}balance.md`, "utf8"), runs));
for (const r of runs) {
  const at = (level: number) => (r.lighthouse[level] === undefined ? "–" : (r.lighthouse[level]! / 24).toFixed(1));
  console.log(`${r.profile.name}: Lighthouse 5 on day ${at(5)}, 10 on day ${at(10)}, 15 on day ${at(15)}; ${r.walls.length} wall(s)`);
}
