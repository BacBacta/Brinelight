/**
 * Semaine 1 : le client affiche des valeurs calculées par les règles partagées,
 * pour prouver que client et serveur lisent exactement les mêmes règles.
 * Semaine 2 : la cité et la mer 3D du prototype seront portées dans src/scene/.
 * Le prototype de référence reste jouable sur /prototype/.
 */
import { BUILDINGS, BUILDING_IDS, STARTING_BUILDINGS, netRates, storeCap, upgradeCost, upgradeTime, type Resource } from "@phare/shared";
import "./style.css";

const RES: Record<Resource, string> = { huile: "huile", poisson: "poisson", bois: "bois", cord: "cordage" };
const fmtCost = (c: Partial<Record<Resource, number>>) =>
  (Object.entries(c) as [Resource, number][]).map(([k, v]) => `${v.toLocaleString("fr-FR")} ${RES[k]}`).join(" · ");
const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")}` : `${Math.round(s / 60)} min`);

const rates = netRates({ buildings: STARTING_BUILDINGS, techs: {}, rafts: {}, survivors: 8, morale: 84 });
const rows = BUILDING_IDS.map((id) => {
  const l = STARTING_BUILDINGS[id];
  return `<tr><td>${BUILDINGS[id].name}</td><td>${l}</td><td>${fmtCost(upgradeCost(id, l))}</td><td>${fmtTime(upgradeTime(id, l))}</td></tr>`;
}).join("");

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<main>
  <p class="eyebrow">Projet Phare · semaine 1</p>
  <h1>Les règles tournent</h1>
  <p>Ces valeurs sont calculées par <code>@phare/shared</code>, le même module que le serveur utilisera pour décider. Cité de départ, temps réel.</p>
  <div class="kpis">
    <div><span>Stockage</span><b>${storeCap(STARTING_BUILDINGS.phare).toLocaleString("fr-FR")}</b></div>
    <div><span>Huile</span><b>${rates.huile.toFixed(1)} / h</b></div>
    <div><span>Poisson</span><b>${rates.poisson.toFixed(1)} / h</b></div>
    <div><span>Bois</span><b>${rates.bois.toFixed(1)} / h</b></div>
  </div>
  <table><thead><tr><th>Bâtiment</th><th>Niveau</th><th>Prochain niveau</th><th>Durée</th></tr></thead><tbody>${rows}</tbody></table>
  <p><a href="/prototype/">Ouvrir le prototype de référence</a></p>
</main>`;
