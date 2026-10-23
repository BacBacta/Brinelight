/**
 * For `early.ts` only (docs/studies/early-game.md): the balance's simulator gets the study's rules (`early-rules.ts`)
 * in place of `@brinelight/shared`. Every other module, and every other command, keeps the shared rules.
 */
export async function resolve(specifier, context, next) {
  if (specifier === "@brinelight/shared" && /\/tools\/balance\/simulate\.[jt]s$/.test(context.parentURL ?? "")) {
    return { url: new URL("./early-rules.ts", import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
