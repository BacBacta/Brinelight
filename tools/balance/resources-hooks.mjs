/**
 * For the resources study only (docs/studies/resources.md, `resources-run.ts`): the balance's simulator gets the
 * study's rules (`resources-rules.ts`) in place of `@brinelight/shared`, and four modules of `shared/` are loaded with
 * a few calls to the study's knobs (`globalThis.brinelightResources`). Without a knob set, every patched function does
 * what the rules do, word for word: a run is the balance's own (checked by `resources-run.ts` before anything else).
 * Nothing is changed in `shared/`; every other command keeps the shared rules as they are.
 */
const K = "globalThis.brinelightResources";

/** Each patch: the exact text of the rules' module as tsx gives it, and what the study puts in its place. */
const PATCHES = {
  "rules/economy.ts": [
    // The storage, and the production (the study's curve): the rules' own functions, called through the knobs.
    ["function storeCap(lighthouse,techs={}){", `function storeCap(lighthouse,techs={}){const k=${K};return k?.storeCap?k.storeCap(lighthouse,techs,storeCapRules):storeCapRules(lighthouse,techs)}function storeCapRules(lighthouse,techs={}){`],
    ["function netRates(s,w={mist:false,stoked:false}){", `function netRates(s,w={mist:false,stoked:false}){const k=${K};return k?.netRates?k.netRates(s,w,netRatesRules):netRatesRules(s,w)}function netRatesRules(s,w={mist:false,stoked:false}){`],
    // What the storage cuts off, written down.
    ["function advanceStock(stock,rates,seconds,cap){", `function advanceStock(stock,rates,seconds,cap){${K}?.stockStep?.(stock,rates,seconds,cap);`],
  ],
  "rules/buildings.ts": [
    // The builders: the rules' (from the survivors), or the study's from the Lighthouse.
    ["if(ctx.queue.length>=builders(ctx.survivors))return refuse(BUILDERS_BUSY);", `{const b=${K}?.builders?.(ctx.buildings)??builders(ctx.survivors);if(ctx.queue.length>=b)return refuse(BUILDERS_BUSY)}`],
  ],
  "rules/sea.ts": [
    // The Wooded Isles and Fish Shoals of the map, open to the fleets as the wrecks when the study says so.
    ['site.kind!=="camp"&&site.kind!=="wreck"&&site.kind!=="leviathan"', 'site.kind!=="camp"&&!studyGathers(site)&&site.kind!=="leviathan"'],
    ['site.kind==="wreck"&&(s.world.wrecks[siteId]??0)<=0', 'studyGathers(site)&&(s.world.wrecks[siteId]??(site.kind==="wreck"?0:1))<=0'],
    ['site.kind!=="wreck"&&totalTroops(s.troops)', '!studyGathers(site)&&totalTroops(s.troops)'],
    // An isle or a shoal never harvested is full: what the study gives it at this Lighthouse level.
    ["const left=s.world.wrecks[f.site]??0;", `const left=s.world.wrecks[f.site]??(${K}?.amount?.(f.site,s.buildings.lighthouse)??0);`],
    // How long an emptied isle or shoal waits before it fills again (the study's; a wreck keeps the rules' wait).
    ["[f.site]:WRECK_REFILL}", `[f.site]:${K}?.refill?.(f.site)??WRECK_REFILL}`],
    ["cargo:{oil:wreckOil(got,s.buildings.lighthouse),rope:WRECK_ROPE}", `cargo:${K}?.cargo?.(f.site,got,s.buildings.lighthouse)??{oil:wreckOil(got,s.buildings.lighthouse),rope:WRECK_ROPE}`],
    // An isle or a shoal filled again is full again, at the Lighthouse's level of its next harvest.
    ["else wrecks[id]=seaSite(id)?.amount??0", 'else if(seaSite(id)?.kind==="wreck")wrecks[id]=seaSite(id)?.amount??0;else delete wrecks[id]'],
    // What a fleet brings home, written down by source.
    ['stock[k]+=f.kind==="collect"&&k!=="rope"?Math.min(v,Math.max(0,cap-stock[k])):v', `{const a=f.kind==="collect"&&k!=="rope"?Math.min(v,Math.max(0,cap-stock[k])):v;${K}?.landed?.(f,k,v,a);stock[k]+=a}`],
  ],
};

const SEA_HELPER = `\nfunction studyGathers(site){return site.kind==="wreck"||(!!${K}?.harvest&&(site.kind==="isle"||site.kind==="fish"))}\n`;

export async function resolve(specifier, context, next) {
  if (specifier === "@brinelight/shared" && /\/tools\/balance\/simulate\.[jt]s$/.test(context.parentURL ?? "")) {
    return { url: new URL("./resources-rules.ts", import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  const result = await next(url, context);
  const file = Object.keys(PATCHES).find((f) => url.split("?")[0].endsWith(`/shared/src/${f}`));
  if (!file) return result;
  let source = typeof result.source === "string" ? result.source : Buffer.from(result.source).toString("utf8");
  for (const [from, to] of PATCHES[file]) {
    // A patch that no longer finds its text stops the study: the rules moved, the study must follow.
    if (source.split(from).length !== 2) throw new Error(`resources-hooks: ${file} no longer has, once, ${from}`);
    source = source.replace(from, () => to);
  }
  if (file === "rules/sea.ts") source += SEA_HELPER;
  return { ...result, source };
}
