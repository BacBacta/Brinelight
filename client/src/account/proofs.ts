/**
 * "Your proofs" in the Profile (week 9, task 5): your milestones sealed on Solana, the notary's official address, and
 * for each sealed one: Check (redone in the browser, with no server), See it on Solana, and Save the proof. The
 * official address comes from the game's own code (`NOTARIES`), never from what the server says.
 */
import { NOTARIES, checkProofHashes, currentNotary, explorerTx, proofFile, type Cluster, type NotaryAddress, type PlayerProof, type SealedIn } from "@brinelight/shared";
import { box, button, esc, listRow, why } from "../ui/components.js";

/** What GET /proofs answers. */
export type ProofsAnswer = { notary: { cluster: Cluster; address: string } | null; proofs: PlayerProof[] };

export const PROOFS_TEXT = {
  title: "Your proofs",
  intro: "Each night, Brinelight seals the day's milestones on Solana. Your proofs show yours are in it.",
  notary: (cluster: Cluster) => `Brinelight's notary on Solana${cluster === "devnet" ? " (devnet, for trying)" : ""}`,
  onlyThis: "Only this address seals Brinelight's proofs.",
  notListed: "The notary's address is not published yet: your proofs cannot be checked against it.",
  waiting: "Waiting for tonight's seal",
  sealed: "Sealed on Solana",
  check: "Check",
  see: "See it on Solana",
  save: "Save the proof",
  checking: "Checking…",
  holds: "This proof matches the seal.",
  noCrypto: "This browser cannot check proofs.",
} as const;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-21" → "21 October 2026". */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1] ?? ""} ${y}`;
}

/** "lighthouse:10" → "Lighthouse 10"; a kind the game does not know yet is shown as it is. */
export function factLabel(fact: string): string {
  const m = /^lighthouse:(\d+)$/.exec(fact);
  return m ? `Lighthouse ${m[1]}` : fact;
}

/** A check's result shown under a proof: under way, it holds, or why it does not. */
export type CheckShown = "checking" | "holds" | string;

/** The section, from what is known; empty until you have a proof (your Lighthouse at 5). Pure. */
export function proofsHtml(answer: ProofsAnswer | null, checks: ReadonlyMap<number, CheckShown>, list: readonly NotaryAddress[] = NOTARIES): string {
  if (!answer || answer.proofs.length === 0) return "";
  const T = PROOFS_TEXT;
  const cluster = answer.notary?.cluster ?? answer.proofs.find((p) => p.seal)?.seal?.cluster ?? "devnet";
  const official = currentNotary(cluster, list);
  const notary = official
    ? `<p class="p"><small>${T.notary(cluster)}:</small><br><code class="addr">${esc(official.address)}</code><br><small>${T.onlyThis}</small></p>`
    : why(T.notListed);
  const rows = `<div class="list">${answer.proofs
        .map((p, i) => {
          const when = p.when === "by" ? `by ${dayLabel(p.day)}` : dayLabel(p.day);
          const sub = `<small>${esc(when)} · ${p.seal ? T.sealed : T.waiting}</small>`;
          const check = checks.get(i);
          const result = check === undefined ? "" : check === "checking" ? `<small>${T.checking}</small>` : check === "holds" ? `<small class="ok">${T.holds}</small>` : why(esc(check));
          const side = p.seal
            ? button(T.check, "sm", "proof-check", ` data-i="${i}"`) +
              `<a class="b sm" href="${esc(explorerTx(p.seal.cluster, p.seal.signature))}" target="_blank" rel="noopener noreferrer">${T.see}</a>` +
              button(T.save, "sm", "proof-save", ` data-i="${i}"`)
            : "";
          return listRow(esc(factLabel(p.fact)), sub + result, `<div class="proof-acts">${side}</div>`, "proof");
        })
        .join("")}</div>`;
  return box(T.title, `<p class="p">${T.intro}</p>${notary}${rows}`, "proofs");
}

/** Checks a sealed proof's hashes in the browser, with Web Crypto: null when it holds, else the reason. */
export async function checkInBrowser(p: PlayerProof & { seal: SealedIn }, subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle): Promise<string | null> {
  if (!subtle) return PROOFS_TEXT.noCrypto;
  return checkProofHashes(p, async (bytes) => new Uint8Array(await subtle.digest("SHA-256", bytes)));
}

/** The saved file's name and text: everything `npm run proof:check` needs, nothing more. */
export function savedProof(p: PlayerProof & { seal: SealedIn }): { name: string; text: string } {
  return { name: `brinelight-proof-${p.fact.replace(/[^a-z0-9-]/g, "-")}.json`, text: `${JSON.stringify(proofFile(p), null, 2)}\n` };
}
