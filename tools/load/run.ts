/**
 * The load test from the command line (docs/perf.md, "How many players one CX23 holds"):
 *
 *   npm run load -- --url https://api.brinelight.xyz --origin https://play.brinelight.xyz
 *
 * Options: --stages 100,250,500  --stage-seconds 600  --action-every 20,60  --launch-every 180,420  --sign-ins 18
 *          --stats (samples `docker stats` on this machine every 5 s: only when the server runs here, as in the CI)
 * Exits with 1 when an answer was neither fine nor a refusal by the rules of the game.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DEFAULTS, line, runLoad, type LoadOptions } from "./load.js";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const pair = (name: string, fallback: [number, number]): [number, number] => {
  const v = arg(name)?.split(",").map(Number);
  return v && v.length === 2 && v.every((x) => x > 0) ? [v[0]!, v[1]!] : fallback;
};

const url = arg("url")?.replace(/\/$/, "");
const origin = arg("origin")?.replace(/\/$/, "");
if (!url || !origin) {
  console.error("Usage: npm run load -- --url https://api.brinelight.xyz --origin https://play.brinelight.xyz [--stages 100,250,500] [--stage-seconds 600] [--stats]");
  process.exit(2);
}
const options: LoadOptions = {
  url,
  origin,
  stages: arg("stages")?.split(",").map(Number) ?? DEFAULTS.stages,
  stageSeconds: Number(arg("stage-seconds") ?? DEFAULTS.stageSeconds),
  actionEvery: pair("action-every", DEFAULTS.actionEvery),
  launchEvery: pair("launch-every", DEFAULTS.launchEvery),
  signInsPerMinute: Number(arg("sign-ins") ?? DEFAULTS.signInsPerMinute),
};

// The machine's processor and memory, per container, while the test runs (only when the server runs on this machine).
const stats: string[] = [];
let sampling: NodeJS.Timeout | undefined;
if (args.includes("--stats")) {
  const run = promisify(execFile);
  const sample = async () => {
    const { stdout } = await run("docker", ["stats", "--no-stream", "--format", "{{.Name}} {{.CPUPerc}} {{.MemUsage}}"]).catch(() => ({ stdout: "" }));
    for (const l of stdout.trim().split("\n").filter(Boolean)) stats.push(l);
  };
  sampling = setInterval(() => void sample(), 5000);
}

const started = Date.now();
const { stages, signIns } = await runLoad(options, (l) => console.log(l));
clearInterval(sampling);

console.log("\nSign-ins (not in the measures): " + line(signIns));
console.log("\n| Players | Answers a second | p50 (ms) | p99 (ms) | Refused by the rules | Too many | Errors |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const r of stages) console.log(`| ${r.players} | ${r.perSecond} | ${r.p50} | ${r.p99} | ${r.rules} | ${r.tooMany} | ${r.errors} |`);
if (stats.length) {
  // The highest processor and memory seen for each container.
  const top = new Map<string, { cpu: number; mem: string }>();
  for (const s of stats) {
    const [name, cpu, mem] = s.split(" ");
    const c = parseFloat(cpu ?? "0");
    if (!top.has(name!) || c > top.get(name!)!.cpu) top.set(name!, { cpu: c, mem: mem ?? "" });
  }
  console.log("\nHighest processor use per container (docker stats, every 5 s):");
  for (const [name, t] of top) console.log(`  ${name}: ${t.cpu} % (memory then ${t.mem})`);
}
console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)} s. The throwaway keys are gone with this process.`);
const bad = [...stages, signIns].some((r) => r.errors > 0 || r.tooMany > 0);
process.exit(bad ? 1 : 0);
