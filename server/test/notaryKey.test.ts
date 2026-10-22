/**
 * The notary's key (week 9, task 3; protected): one variable per network, read once and taken out of the environment,
 * and the script that makes it on the server. Every key here is made by the test and forgotten with it.
 */
import { execFile } from "node:child_process";
import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect, promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { base58Decode, base58Encode } from "../src/auth/base58.js";
import { verifyEd25519 } from "../src/auth/ed25519.js";
import { loadNotary } from "../src/proofs/key.js";
import { keygenOutput, makeNotaryKey } from "../src/proofs/keygen.js";

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("the notary's key in the environment", () => {
  it("off without SOLANA_CLUSTER, and a typo in SOLANA_CLUSTER stops the server", () => {
    const k = makeNotaryKey();
    expect(loadNotary({ NOTARY_KEY_DEVNET: k.secret })).toEqual({ status: "off", reason: "No SOLANA_CLUSTER: the notary is off" });
    expect(() => loadNotary({ SOLANA_CLUSTER: "testnet", NOTARY_KEY_DEVNET: k.secret })).toThrow("SOLANA_CLUSTER must be devnet or mainnet");
    expect(() => loadNotary({ SOLANA_CLUSTER: "Mainnet" })).toThrow();
  });

  it("devnet reads NOTARY_KEY_DEVNET only, mainnet NOTARY_KEY_MAINNET only", () => {
    const d = makeNotaryKey();
    const m = makeNotaryKey();
    const dev = loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: d.secret, NOTARY_KEY_MAINNET: m.secret });
    expect(dev.status === "on" && [dev.key.cluster, dev.key.address]).toEqual(["devnet", d.address]);
    const main = loadNotary({ SOLANA_CLUSTER: "mainnet", NOTARY_KEY_DEVNET: d.secret, NOTARY_KEY_MAINNET: m.secret });
    expect(main.status === "on" && [main.key.cluster, main.key.address]).toEqual(["mainnet", m.address]);
    // A devnet key alone never signs on mainnet, nor a mainnet key alone on devnet.
    expect(loadNotary({ SOLANA_CLUSTER: "mainnet", NOTARY_KEY_DEVNET: d.secret })).toEqual({ status: "off", reason: "No NOTARY_KEY_MAINNET: the notary is off" });
    expect(loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_MAINNET: m.secret })).toEqual({ status: "off", reason: "No NOTARY_KEY_DEVNET: the notary is off" });
  });

  it("the same key on both networks is refused", () => {
    const k = makeNotaryKey();
    const loaded = loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: k.secret, NOTARY_KEY_MAINNET: k.secret });
    expect(loaded).toEqual({ status: "off", reason: "NOTARY_KEY_DEVNET and NOTARY_KEY_MAINNET hold the same key: each network needs its own" });
  });

  it("both key variables leave the environment as soon as they are read, whatever the outcome", () => {
    for (const cluster of [undefined, "devnet", "mainnet"]) {
      const env: Record<string, string | undefined> = { SOLANA_CLUSTER: cluster, NOTARY_KEY_DEVNET: makeNotaryKey().secret, NOTARY_KEY_MAINNET: "not a key" };
      loadNotary(env);
      expect(Object.keys(env).filter((k) => k.startsWith("NOTARY_KEY"))).toEqual([]);
    }
    const env: Record<string, string | undefined> = { SOLANA_CLUSTER: "testnet", NOTARY_KEY_DEVNET: "x" };
    expect(() => loadNotary(env)).toThrow();
    expect(env.NOTARY_KEY_DEVNET).toBeUndefined();
  });

  it("a key that is not one is refused without its value being said", () => {
    const k = makeNotaryKey();
    const bytes = base58Decode(k.secret)!;
    const wrongPublic = Uint8Array.from(bytes);
    wrongPublic[63] = wrongPublic[63]! ^ 1;
    const bad = [k.address, k.secret.slice(0, -2), base58Encode(wrongPublic), `${k.secret}0`, "0".repeat(88), JSON.stringify([...bytes])];
    for (const text of bad) {
      const loaded = loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: text });
      expect(loaded.status).toBe("off");
      expect(JSON.stringify(loaded)).not.toContain(text);
      expect(JSON.stringify(loaded)).toContain("NOTARY_KEY_DEVNET is not a notary key");
    }
  });

  it("signs like the key it was made from, and shows nothing of the key when printed", () => {
    const k = makeNotaryKey();
    const loaded = loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: k.secret });
    if (loaded.status !== "on") throw new Error(loaded.reason);
    const message = new TextEncoder().encode("brinelight proof v1 2026-10-22 00");
    expect(verifyEd25519(base58Decode(k.address)!, message, loaded.key.sign(message))).toBe(true);
    const seed = Buffer.from(base58Decode(k.secret)!.subarray(0, 32));
    for (const shown of [JSON.stringify(loaded), inspect(loaded, { depth: 10, showHidden: true }), String(loaded.key)]) {
      expect(shown).not.toContain(k.secret);
      expect(shown).not.toContain(seed.toString("hex"));
      expect(shown).not.toContain(seed.toString("base64"));
    }
  });

  it("each new key is another: 64 bytes in base58, the public key last", () => {
    const a = makeNotaryKey();
    const b = makeNotaryKey();
    expect(a.secret).not.toBe(b.secret);
    expect(base58Decode(a.secret)!.length).toBe(64);
    expect(base58Encode(base58Decode(a.secret)!.subarray(32))).toBe(a.address);
    expect(keygenOutput(a)).toBe(`address ${a.address}\nsecret ${a.secret}\n`);
  });
});

describe("deploy/notary-key.sh", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

  /**
   * A copy of the deploy folder's script with a deploy/.env, and a fake `docker` that runs the real keygen with this
   * repository's Node (as the container would), fails, or answers something else.
   */
  function setUp(env: string, docker: "keygen" | "fail" | "junk" = "keygen") {
    const dir = mkdtempSync(join(tmpdir(), "notary-key-"));
    dirs.push(dir);
    cpSync(join(ROOT, "deploy/notary-key.sh"), join(dir, "notary-key.sh"));
    writeFileSync(join(dir, ".env"), env);
    chmodSync(join(dir, ".env"), 0o644);
    const body =
      docker === "keygen"
        ? `exec node --import tsx "${join(ROOT, "server/src/proofs/keygen.ts")}"`
        : docker === "fail"
          ? "echo 'no such service' >&2; exit 1"
          : "echo 'Creating container'; echo 'address nope'";
    writeFileSync(join(dir, "docker"), `#!/usr/bin/env bash\ncd "${ROOT}"\n${body}\n`);
    chmodSync(join(dir, "docker"), 0o755);
    return { dir, script: join(dir, "notary-key.sh"), env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } };
  }
  const go = async (s: ReturnType<typeof setUp>, ...args: string[]) => {
    try {
      const r = await run("bash", [s.script, ...args], { env: s.env });
      return { code: 0, stdout: r.stdout, stderr: r.stderr };
    } catch (e) {
      const err = e as { code: number; stdout: string; stderr: string };
      return { code: err.code, stdout: err.stdout, stderr: err.stderr };
    }
  };
  const envOf = (s: ReturnType<typeof setUp>) => readFileSync(join(s.dir, ".env"), "utf8");

  it("writes the key into .env (mode 600), shows only its address, and the server reads it", async () => {
    const s = setUp("API_DOMAIN=api.example.org\nPOSTGRES_PASSWORD=abc\n");
    const r = await go(s, "devnet");
    expect(r.code).toBe(0);
    const env = envOf(s);
    const line = env.split("\n").find((l) => l.startsWith("NOTARY_KEY_DEVNET="))!;
    const secret = line.slice("NOTARY_KEY_DEVNET=".length);
    expect(secret).toMatch(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/);
    expect(env.startsWith("API_DOMAIN=api.example.org\nPOSTGRES_PASSWORD=abc\n")).toBe(true);
    expect(statSync(join(s.dir, ".env")).mode & 0o777).toBe(0o600);
    expect(r.stdout + r.stderr).not.toContain(secret);
    const loaded = loadNotary({ SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: secret });
    if (loaded.status !== "on") throw new Error(loaded.reason);
    expect(r.stdout).toContain(`Its public address (you can share it): ${loaded.key.address}`);
  }, 30_000);

  it("never replaces a key already there; mainnet gets its own variable and its own key", async () => {
    const s = setUp("POSTGRES_PASSWORD=abc\n");
    expect((await go(s, "devnet")).code).toBe(0);
    const once = envOf(s);
    const again = await go(s, "devnet");
    expect(again.code).toBe(1);
    expect(again.stderr).toContain("A devnet key is already in deploy/.env (NOTARY_KEY_DEVNET): nothing was changed.");
    expect(envOf(s)).toBe(once);
    expect((await go(s, "mainnet")).code).toBe(0);
    const keys = envOf(s)
      .split("\n")
      .filter((l) => l.startsWith("NOTARY_KEY_"));
    expect(keys.map((l) => l.split("=")[0])).toEqual(["NOTARY_KEY_DEVNET", "NOTARY_KEY_MAINNET"]);
    expect(keys[0]!.split("=")[1]).not.toBe(keys[1]!.split("=")[1]);
  }, 60_000);

  it("an empty line from .env.example is filled, not doubled", async () => {
    const s = setUp("NOTARY_KEY_DEVNET=\nPOSTGRES_PASSWORD=abc\n");
    expect((await go(s, "devnet")).code).toBe(0);
    expect(envOf(s).match(/^NOTARY_KEY_DEVNET=/gm)).toHaveLength(1);
    expect(envOf(s)).toMatch(/^NOTARY_KEY_DEVNET=[1-9A-HJ-NP-Za-km-z]{80,90}$/m);
    expect(envOf(s)).toContain("POSTGRES_PASSWORD=abc\n");
  }, 30_000);

  it("writes nothing when something is wrong", async () => {
    const plain = "POSTGRES_PASSWORD=abc\n";
    const noCluster = setUp(plain);
    expect((await go(noCluster)).code).toBe(2);
    expect((await go(noCluster, "testnet")).code).toBe(2);
    const failing = setUp(plain, "fail");
    const f = await go(failing, "devnet");
    expect(f.code).toBe(1);
    expect(f.stderr).toContain("The key could not be made");
    expect(envOf(failing)).toBe(plain);
    const junk = setUp(plain, "junk");
    expect((await go(junk, "devnet")).code).toBe(1);
    expect(envOf(junk)).toBe(plain);
    const noEnv = setUp(plain);
    rmSync(join(noEnv.dir, ".env"));
    expect((await go(noEnv, "devnet")).code).toBe(1);
  }, 30_000);
});
