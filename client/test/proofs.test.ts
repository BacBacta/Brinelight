import { fromHex, parseProofFile, type NotaryAddress, type PlayerProof, type SealedIn } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { PROOFS_TEXT, checkInBrowser, dayLabel, factLabel, proofsHtml, savedProof, type ProofsAnswer } from "../src/account/proofs.js";
import vectors from "../../shared/test/fixtures/proofs-v1.json" with { type: "json" };

const ex = vectors.example;
const two = vectors.trees[1]!;
const SIGNATURE = "5".repeat(87);
const NOTARY = "FVen3X669xLzsi6N2V91DoiyzHzg1uAgqiT8jZ9nS96Z";
const official: NotaryAddress[] = [{ cluster: "devnet", address: NOTARY, from: "2026-10-01", until: null }];
/** Leaf 0 of the vectors, in the tree of two leaves. */
const sealed: PlayerProof & { seal: SealedIn } = {
  fact: ex.fact,
  when: "on",
  day: ex.day,
  salt: ex.salt,
  wallet: ex.wallet,
  leaf: ex.leaf,
  seal: { cluster: "devnet", day: "2026-10-22", root: two.root, signature: SIGNATURE, path: two.paths["0"] as SealedIn["path"] },
};
const waiting: PlayerProof = { ...sealed, fact: "lighthouse:10", when: "by", day: "2026-10-23", seal: null };
const answer: ProofsAnswer = { notary: { cluster: "devnet", address: NOTARY }, proofs: [sealed, waiting] };

describe("Your proofs", () => {
  it("words for the player", () => {
    expect(dayLabel("2026-10-21")).toBe("21 October 2026");
    expect(dayLabel("2027-01-05")).toBe("5 January 2027");
    expect(factLabel("lighthouse:10")).toBe("Lighthouse 10");
    expect(factLabel("guardians:2027-s1")).toBe("guardians:2027-s1");
  });

  it("nothing until you have a proof: the Profile stays as it was", () => {
    expect(proofsHtml(null, new Map())).toBe("");
    expect(proofsHtml({ notary: null, proofs: [] }, new Map())).toBe("");
    expect(proofsHtml({ notary: { cluster: "devnet", address: NOTARY }, proofs: [] }, new Map(), official)).toBe("");
  });

  it("the notary's official address, from the game's own list, in full", () => {
    const html = proofsHtml(answer, new Map(), official);
    expect(html).toContain(PROOFS_TEXT.title);
    expect(html).toContain(`<code class="addr">${NOTARY}</code>`);
    expect(html).toContain(PROOFS_TEXT.onlyThis);
    expect(html).toContain("(devnet, for trying)");
    // Not in the game's list: said so, whatever address the server gives.
    expect(proofsHtml(answer, new Map(), [])).toContain(PROOFS_TEXT.notListed);
  });

  it("a sealed proof: Check, See it on Solana (devnet), Save; a waiting one: its day, and nothing to press", () => {
    const html = proofsHtml(answer, new Map(), official);
    expect(html).toContain("<b>Lighthouse 5</b><small>10 October 2026 · Sealed on Solana</small>");
    expect(html).toContain("<b>Lighthouse 10</b><small>by 23 October 2026 · Waiting for tonight's seal</small>");
    expect(html).toContain(`href="https://explorer.solana.com/tx/${SIGNATURE}?cluster=devnet"`);
    expect(html).toContain('data-act="proof-check" data-i="0"');
    expect(html).toContain('data-act="proof-save" data-i="0"');
    expect(html).not.toContain('data-i="1"');
  });

  it("the check's result under its proof", () => {
    expect(proofsHtml(answer, new Map([[0, "checking"]]), official)).toContain(PROOFS_TEXT.checking);
    expect(proofsHtml(answer, new Map([[0, "holds"]]), official)).toContain(`<small class="ok">${PROOFS_TEXT.holds}</small>`);
    expect(proofsHtml(answer, new Map([[0, "This proof's path does not lead to the seal's root."]]), official)).toContain("does not lead to the seal");
  });

  it("checks in the browser with Web Crypto: a true proof holds, one changed byte does not", async () => {
    expect(await checkInBrowser(sealed)).toBeNull();
    expect(await checkInBrowser({ ...sealed, day: "2026-10-11" })).toBe("This proof's details do not match its leaf.");
    expect(await checkInBrowser({ ...sealed, seal: { ...sealed.seal, root: "00".repeat(32) } })).toBe("This proof's path does not lead to the seal's root.");
    expect(await checkInBrowser({ ...sealed, salt: "zz" })).toBe("This proof is not in the right format.");
    expect(await checkInBrowser(sealed, undefined)).toBeNull();
    expect(fromHex(sealed.leaf)!.length).toBe(32);
  });

  it("the saved file is a proof file, and nothing more", () => {
    const file = savedProof(sealed);
    expect(file.name).toBe("brinelight-proof-lighthouse-5.json");
    const read = parseProofFile(JSON.parse(file.text));
    expect(read).toEqual({ format: "brinelight proof v1", fact: ex.fact, when: "on", day: ex.day, salt: ex.salt, wallet: ex.wallet, leaf: ex.leaf, seal: sealed.seal });
  });
});
