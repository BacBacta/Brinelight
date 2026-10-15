/**
 * Week 1: the client displays values computed by the shared rules,
 * to prove that the client and the server read exactly the same rules.
 * Shown with ?rules in the URL.
 */
import { BUILDINGS, BUILDING_IDS, STARTING_BUILDINGS, netRates, storeCap, upgradeCost, upgradeTime, type Resource } from "@brinelight/shared";

const RES: Record<Resource, string> = { oil: "oil", fish: "fish", wood: "wood", rope: "rope" };
const fmtCost = (c: Partial<Record<Resource, number>>) =>
  (Object.entries(c) as [Resource, number][]).map(([k, v]) => `${v.toLocaleString("en-US")} ${RES[k]}`).join(" · ");
const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")} min` : `${Math.round(s / 60)} min`);

const rates = netRates({ buildings: STARTING_BUILDINGS, techs: {}, rafts: {}, survivors: 8, morale: 84 });
const rows = BUILDING_IDS.map((id) => {
  const l = STARTING_BUILDINGS[id];
  return `<tr><td>${BUILDINGS[id].name}</td><td>${l}</td><td>${fmtCost(upgradeCost(id, l))}</td><td>${fmtTime(upgradeTime(id, l))}</td></tr>`;
}).join("");

export function showRules(app: HTMLElement): void {
  app.innerHTML = `
<main>
  <p class="eyebrow">Brinelight · week 1</p>
  <h1>The rules are running</h1>
  <p>These values are computed by <code>@brinelight/shared</code>, the same module the server will use to decide. Starting city, real time.</p>
  <div class="kpis">
    <div><span>Storage</span><b>${storeCap(STARTING_BUILDINGS.lighthouse).toLocaleString("en-US")}</b></div>
    <div><span>Oil</span><b>${rates.oil.toFixed(1)} / hr</b></div>
    <div><span>Fish</span><b>${rates.fish.toFixed(1)} / hr</b></div>
    <div><span>Wood</span><b>${rates.wood.toFixed(1)} / hr</b></div>
  </div>
  <table><thead><tr><th>Building</th><th>Level</th><th>Next level</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table>
  <p><a href="/prototype/">Open the reference prototype</a></p>
</main>`;
}
