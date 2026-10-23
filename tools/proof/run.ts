/**
 * npm run proof:check -- <proof file> [--rpc https://…]
 * Checks a proof saved from the game ("Save the proof") against Solana, with a public endpoint of the proof's network
 * (or the one given), and without Brinelight's server. Exits with 1 if anything does not hold.
 */
import { readFile } from "node:fs/promises";
import { parseProofFile } from "@brinelight/shared";
import { createRpc } from "../../server/src/proofs/rpc.js";
import { checkProof } from "./check.js";

const args = process.argv.slice(2);
const rpcAt = args.indexOf("--rpc");
const rpcUrl = rpcAt >= 0 ? args[rpcAt + 1] : undefined;
const file = args.find((a, i) => !a.startsWith("--") && i !== rpcAt + 1);
if (!file || (rpcAt >= 0 && !rpcUrl?.startsWith("https://"))) {
  console.error("Use: npm run proof:check -- <proof file> [--rpc https://…]");
  process.exit(2);
}

let proof;
try {
  proof = parseProofFile(JSON.parse(await readFile(file, "utf8")));
} catch {
  proof = null;
}
if (!proof) {
  console.error(`${file} is not a Brinelight proof file.`);
  process.exit(1);
}

const rpc = createRpc(proof.seal.cluster, rpcUrl ? { urls: [rpcUrl] } : {});
const lines = await checkProof(proof, rpc);
for (const l of lines) console.log(`${l.ok ? "✓" : "✗"} ${l.text}`);
const ok = lines.every((l) => l.ok);
console.log(ok ? "This proof holds." : "This proof does not hold.");
process.exit(ok ? 0 : 1);
