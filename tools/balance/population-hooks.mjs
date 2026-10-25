/**
 * For `population-run.ts` only (docs/studies/population.md): the balance's simulator gets the study's rules
 * (`population-rules.ts`) in place of `@brinelight/shared`, and the rule of the builders reads the study's count
 * (`globalThis.brinelightPopulation.builders`, set from the city's survivors) instead of the rules' own. Without a
 * proposal the count is the rules' own. Nothing is changed in `shared/`; every other command keeps the shared rules.
 */
const K = "globalThis.brinelightPopulation";

const PATCHES = {
  "rules/buildings.ts": [
    ["if(ctx.queue.length>=builders(ctx.survivors))return refuse(BUILDERS_BUSY);", `{const b=${K}?.builders??builders(ctx.survivors);if(ctx.queue.length>=b)return refuse(BUILDERS_BUSY)}`],
  ],
};

export async function resolve(specifier, context, next) {
  if (specifier === "@brinelight/shared" && /\/tools\/balance\/simulate\.[jt]s$/.test(context.parentURL ?? "")) {
    return { url: new URL("./population-rules.ts", import.meta.url).href, shortCircuit: true };
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
    if (source.split(from).length !== 2) throw new Error(`population-hooks: ${file} no longer has, once, ${from}`);
    source = source.replace(from, () => to);
  }
  return { ...result, source };
}
