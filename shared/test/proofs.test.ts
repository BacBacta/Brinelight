import { describe, expect, it } from "vitest";
import {
  CLUSTERS,
  HOUR,
  NOTARIES,
  checkProofHashes,
  currentNotary,
  explorerTx,
  isOfficialNotary,
  parseProofFile,
  proofFile,
  LIGHTHOUSE_MILESTONES,
  PROOF_VERSION,
  catchUp,
  fromHex,
  isFact,
  isProofDay,
  isWalletText,
  leafBytes,
  lighthouseFact,
  milestonesReached,
  newPlayerState,
  nodeBytes,
  parseSealMemo,
  proofDay,
  sealMemo,
  toHex,
  type PlayerState,
  type ProofLeaf,
} from "../src/index.js";
import vectors from "./fixtures/proofs-v1.json" with { type: "json" };

const ex = vectors.example;
const leaf = (over: Partial<ProofLeaf> = {}): ProofLeaf => ({ salt: fromHex(ex.salt)!, wallet: ex.wallet, fact: ex.fact, when: ex.when as "on", day: ex.day, ...over });
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("the proof's format, v1", () => {
  it("a leaf's bytes, byte by byte as docs/proofs.md writes them", () => {
    const byHand = [
      0x00,
      ...ascii("brinelight proof v1"),
      ...fromHex(ex.salt)!,
      ex.wallet.length,
      ...ascii(ex.wallet),
      "lighthouse:5".length,
      ...ascii("lighthouse:5"),
      2,
      ...ascii("on"),
      10,
      ...ascii("2026-10-10"),
    ];
    expect(PROOF_VERSION).toBe("brinelight proof v1");
    expect([...leafBytes(leaf())!]).toEqual(byHand);
    expect(toHex(leafBytes(leaf())!)).toBe(ex.bytes);
  });

  it("the milestones are the Lighthouse's 5, 10, 15, 20, 25 and 30", () => {
    expect(LIGHTHOUSE_MILESTONES).toEqual([5, 10, 15, 20, 25, 30]);
    expect(lighthouseFact(10)).toBe("lighthouse:10");
  });

  it("a fact is <kind>:<value>, so later kinds need no new version", () => {
    for (const f of ["lighthouse:5", "guardians:2027-s1", "tides-season:12"]) expect(isFact(f), f).toBe(true);
    for (const f of ["lighthouse", ":5", "Lighthouse:5", "lighthouse:5:6", "lighthouse: 5", "lighthouse:é", "a".repeat(25) + ":1", "x:" + "1".repeat(33), 5, null])
      expect(isFact(f), String(f)).toBe(false);
    expect(leafBytes(leaf({ fact: "guardians:2027-s1" }))).not.toBeNull();
  });

  it("a day is a real UTC day, YYYY-MM-DD", () => {
    expect(isProofDay("2026-10-22")).toBe(true);
    expect(isProofDay("2028-02-29")).toBe(true);
    for (const d of ["2026-02-30", "2026-13-01", "2026-1-01", "22/10/2026", "2026-10-22T00:00:00Z", "", 20261022]) expect(isProofDay(d), String(d)).toBe(false);
    expect(proofDay(1_792_281_600)).toBe("2026-10-18");
    expect(proofDay(1_792_281_600 - 1)).toBe("2026-10-17");
    // Against the platform's own calendar, every 7 hours and a bit over 60 years, leap days included.
    for (let t = 0; t < 60 * 365.25 * 86_400; t += 7 * 3600 + 13) expect(proofDay(t)).toBe(new Date(t * 1000).toISOString().slice(0, 10));
    for (let t = 0; t < 60 * 365.25 * 86_400; t += 86_400) expect(isProofDay(proofDay(t))).toBe(true);
  });

  it("a leaf that does not follow the format has no bytes", () => {
    expect(leafBytes(leaf({ salt: new Uint8Array(15) }))).toBeNull();
    expect(leafBytes(leaf({ salt: new Uint8Array(17) }))).toBeNull();
    expect(leafBytes(leaf({ wallet: "0OIl" + ex.wallet.slice(4) }))).toBeNull();
    expect(leafBytes(leaf({ wallet: "abc" }))).toBeNull();
    expect(leafBytes(leaf({ fact: "lighthouse" }))).toBeNull();
    expect(leafBytes(leaf({ when: "at" as "on" }))).toBeNull();
    expect(leafBytes(leaf({ day: "2026-02-30" }))).toBeNull();
    expect(isWalletText(ex.wallet)).toBe(true);
  });

  it("a field never spills into the next: moving a character between two fields changes the bytes", () => {
    const a = leafBytes(leaf({ fact: "lighthouse:10", when: "on" }))!;
    const b = leafBytes(leaf({ fact: "lighthouse:1", when: "on" }))!;
    expect(toHex(a)).not.toBe(toHex(b));
    // Without the lengths, "lighthouse:1" + "0on…" and "lighthouse:10" + "on…" would read alike.
    expect(a.length).toBe(b.length + 1);
  });

  it("a node starts with 0x01 and a leaf with 0x00: one can never pass for the other", () => {
    const h = new Uint8Array(32).fill(7);
    const n = nodeBytes(h, h);
    expect(n[0]).toBe(0x01);
    expect(n.length).toBe(65);
    expect(leafBytes(leaf())![0]).toBe(0x00);
    expect(() => nodeBytes(h, new Uint8Array(31))).toThrow();
  });

  it("the memo of a seal: the version, the day sealed, the root in hex, and nothing else", () => {
    const root = fromHex(vectors.trees[4]!.root)!;
    const memo = sealMemo("2026-10-22", root);
    expect(memo).toBe(`brinelight proof v1 2026-10-22 ${vectors.trees[4]!.root}`);
    expect(parseSealMemo(memo)).toEqual({ day: "2026-10-22", root });
    for (const m of [memo + " ", memo.toUpperCase(), memo.replace("v1", "v2"), memo.slice(0, -1), "brinelight proof v1 2026-02-30 " + "0".repeat(64)]) expect(parseSealMemo(m), m).toBeNull();
    expect(() => sealMemo("2026-10-22", new Uint8Array(31))).toThrow();
  });

  it("hex both ways, and only lowercase hex is read", () => {
    expect(toHex(Uint8Array.from([0, 15, 255]))).toBe("000fff");
    expect([...fromHex("000fff")!]).toEqual([0, 15, 255]);
    for (const h of ["0", "0g", "FF", " 00"]) expect(fromHex(h), h).toBeNull();
  });
});

/** 18 October 2026, 00:00 UTC. */
const MIDNIGHT = 1_792_281_600;

/** A city at Lighthouse `level`, its upgrade to the next level ending `left` seconds after its clock when given. */
function city(level: number, left?: number, clock = MIDNIGHT): PlayerState {
  const s = newPlayerState(clock);
  return { ...s, buildings: { ...s.buildings, lighthouse: level }, queue: left === undefined ? [] : [{ id: "lighthouse", left, duration: left }] };
}

describe("the Lighthouse's milestones a saved city reached", () => {
  it("the level the upgrade gave: on the day its work ended", () => {
    const before = city(4, 22 * HOUR + 30 * 60);
    const after = catchUp(before, 30 * HOUR);
    expect(after.buildings.lighthouse).toBe(5);
    expect(milestonesReached(before, after, new Set(), "2026-10-19")).toEqual([{ fact: "lighthouse:5", when: "on", day: "2026-10-18" }]);
  });

  it("never after the day of the save", () => {
    const before = city(9, 3 * HOUR);
    const after = catchUp(before, 3 * HOUR);
    expect(milestonesReached(before, after, new Set(["lighthouse:5"]), "2026-10-17")).toEqual([{ fact: "lighthouse:10", when: "on", day: "2026-10-17" }]);
  });

  it("a level that is not a milestone gives nothing", () => {
    const before = city(5, HOUR);
    const after = catchUp(before, HOUR);
    expect(after.buildings.lighthouse).toBe(6);
    expect(milestonesReached(before, after, new Set(["lighthouse:5"]), "2026-10-18")).toEqual([]);
  });

  it("milestones passed before they were recorded: by the day of the save, and nothing more", () => {
    const c = city(12);
    expect(milestonesReached(c, c, new Set(), "2026-10-23")).toEqual([
      { fact: "lighthouse:5", when: "by", day: "2026-10-23" },
      { fact: "lighthouse:10", when: "by", day: "2026-10-23" },
    ]);
    expect(milestonesReached(c, c, new Set(["lighthouse:5", "lighthouse:10"]), "2026-10-23")).toEqual([]);
  });

  it("a city that rose to 10 with 5 never recorded: 10 on its day, 5 by the save", () => {
    const before = city(9, HOUR);
    const after = catchUp(before, HOUR);
    expect(milestonesReached(before, after, new Set(), "2026-10-18")).toEqual([
      { fact: "lighthouse:5", when: "by", day: "2026-10-18" },
      { fact: "lighthouse:10", when: "on", day: "2026-10-18" },
    ]);
  });

  it("a Lighthouse still at work gives nothing yet", () => {
    const before = city(4, 2 * HOUR);
    const after = catchUp(before, HOUR);
    expect(milestonesReached(before, after, new Set(), "2026-10-18")).toEqual([]);
  });

  it("a new city gives nothing", () => {
    const c = newPlayerState(MIDNIGHT);
    expect(milestonesReached(c, c, new Set(), "2026-10-18")).toEqual([]);
  });
});

describe("a proof file, and its check with no network", () => {
  const two = vectors.trees[1]!;
  const file = {
    format: "brinelight proof v1",
    fact: ex.fact,
    when: ex.when,
    day: ex.day,
    salt: ex.salt,
    wallet: ex.wallet,
    leaf: ex.leaf,
    seal: { cluster: "devnet", day: "2026-10-22", root: two.root, signature: "5".repeat(87), path: two.paths["0"] },
  };
  const sha256 = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));

  it("is read strictly: every field in its format, nothing else", () => {
    expect(parseProofFile(file)).toEqual(file);
    expect(parseProofFile(proofFile({ ...file, when: "on", seal: parseProofFile(file)!.seal }))).toEqual(file);
    const broken: unknown[] = [
      { ...file, extra: 1 },
      { ...file, format: "brinelight proof v2" },
      { ...file, salt: ex.salt.toUpperCase() },
      { ...file, leaf: ex.leaf.slice(1) },
      { ...file, day: "2026-02-30" },
      { ...file, when: "at" },
      { ...file, seal: { ...file.seal, cluster: "testnet" } },
      { ...file, seal: { ...file.seal, extra: 1 } },
      { ...file, seal: { ...file.seal, path: [{ side: "up", hash: "00".repeat(32) }] } },
      { ...file, seal: { ...file.seal, path: [{ side: "left", hash: "00".repeat(32), more: 1 }] } },
      { ...file, seal: { ...file.seal, signature: "0OIl" } },
      [file],
      null,
    ];
    for (const b of broken) expect(parseProofFile(b), JSON.stringify(b)).toBeNull();
  });

  it("a true proof holds; its reasons when it does not", async () => {
    const p = parseProofFile(file)!;
    expect(await checkProofHashes(p, sha256)).toBeNull();
    expect(await checkProofHashes({ ...p, wallet: vectors.wallet.replace(/.$/, "1") }, sha256)).toBe("This proof's details do not match its leaf.");
    expect(await checkProofHashes({ ...p, seal: { ...p.seal, path: [] } }, sha256)).toBe("This proof's path does not lead to the seal's root.");
    expect(await checkProofHashes({ ...p, seal: { ...p.seal, path: [{ side: "right", hash: "00" }] } }, sha256)).toBe("This proof's path is not in the right format.");
    expect(await checkProofHashes({ ...p, salt: "00" }, sha256)).toBe("This proof is not in the right format.");
    // The 1,000-leaf tree: 10 steps for the first leaf; fewer for the last, which goes up alone where its level is odd.
    const big = vectors.trees[4]!;
    expect((big.paths["0"] as unknown[]).length).toBe(10);
    expect((big.paths["999"] as unknown[]).length).toBe(8);
  });
});

describe("the notary's official addresses", () => {
  const list = [
    { cluster: "devnet" as const, address: "A".repeat(43), from: "2026-10-22", until: "2026-12-31" },
    { cluster: "devnet" as const, address: "B".repeat(43), from: "2027-01-01", until: null, leaked: "2027-03-01" },
    { cluster: "mainnet" as const, address: "C".repeat(43), from: "2027-01-01", until: null },
  ];
  it("an address is official on its network, from its first day to its last, and never from the day it leaked", () => {
    expect(NOTARIES.every((n) => isWalletText(n.address) && isProofDay(n.from))).toBe(true);
    expect(currentNotary("devnet", list)!.address).toBe("B".repeat(43));
    expect(currentNotary("mainnet", [])).toBeNull();
    expect(isOfficialNotary("devnet", "A".repeat(43), "2026-10-22", list)).toBe(true);
    expect(isOfficialNotary("devnet", "A".repeat(43), "2026-10-21", list)).toBe(false);
    expect(isOfficialNotary("devnet", "A".repeat(43), "2027-01-01", list)).toBe(false);
    expect(isOfficialNotary("mainnet", "A".repeat(43), "2026-11-01", list)).toBe(false);
    expect(isOfficialNotary("devnet", "B".repeat(43), "2027-02-28", list)).toBe(true);
    expect(isOfficialNotary("devnet", "B".repeat(43), "2027-03-01", list)).toBe(false);
    expect(explorerTx("devnet", "sig")).toBe("https://explorer.solana.com/tx/sig?cluster=devnet");
    expect(explorerTx("mainnet", "sig")).toBe("https://explorer.solana.com/tx/sig");
    expect(CLUSTERS.devnet.genesis).toBe("EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG");
    expect(CLUSTERS.mainnet.genesis).toBe("5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d");
  });
});
