/**
 * For `sea-hunt-run.ts` only (docs/studies/sea-hunt.md): the balance's simulator gets the study's rules
 * (`sea-hunt-rules.ts`) in place of `@brinelight/shared`, and the rule that counts the fleets at sea also counts those
 * away on an expedition (`globalThis.brinelightSeaHunt.away`). Without a proposal none is away and the rule is the
 * shared one. Nothing is changed in `shared/`; every other command keeps the shared rules.
 */
const K = "globalThis.brinelightSeaHunt";

const PATCHES = {
  "rules/sea.ts": [["if(s.fleets.length>=fleetsMax(s.buildings.harbor)){", `if(s.fleets.length+(${K}?.away.length??0)>=fleetsMax(s.buildings.harbor)){`]],
};

export async function resolve(specifier, context, next) {
  if (specifier === "@brinelight/shared" && /\/tools\/balance\/simulate\.[jt]s$/.test(context.parentURL ?? "")) {
    return { url: new URL("./sea-hunt-rules.ts", import.meta.url).href, shortCircuit: true };
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
    if (source.split(from).length !== 2) throw new Error(`sea-hunt-hooks: ${file} no longer has, once, ${from}`);
    source = source.replace(from, () => to);
  }
  return { ...result, source };
}
