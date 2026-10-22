/**
 * The notary's key (week 9, task 3; protected): one file per network, mounted as a Docker Compose secret and read
 * once, never an environment variable; and the script that makes it on the server. Every key here is made by the test
 * and forgotten with it.
 */
import { execFile } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect, promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { base58Decode, base58Encode } from "../src/auth/base58.js";
import { verifyEd25519 } from "../src/auth/ed25519.js";
import { KEY_FILES, loadNotary } from "../src/proofs/key.js";
import { keygenOutput, makeNotaryKey } from "../src/proofs/keygen.js";
import { readMemoTransaction } from "../src/proofs/transaction.js";

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A secrets folder as Docker Compose mounts it, with these files. */
function secrets(files: { devnet?: string; mainnet?: string } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "secrets-"));
  dirs.push(dir);
  for (const [cluster, text] of Object.entries(files)) if (text !== undefined) writeFileSync(join(dir, KEY_FILES[cluster as "devnet"]), text, { mode: 0o600 });
  return dir;
}

describe("the notary's key, from its file", () => {
  it("off without SOLANA_CLUSTER, and a typo in SOLANA_CLUSTER stops the server", () => {
    const dir = secrets({ devnet: makeNotaryKey().secret });
    expect(loadNotary({}, dir)).toEqual({ status: "off", reason: "No SOLANA_CLUSTER: the notary is off" });
    expect(() => loadNotary({ SOLANA_CLUSTER: "testnet" }, dir)).toThrow("SOLANA_CLUSTER must be devnet or mainnet");
    expect(() => loadNotary({ SOLANA_CLUSTER: "Mainnet" }, dir)).toThrow();
  });

  it("devnet reads notary-devnet.key, mainnet notary-mainnet.key", () => {
    const d = makeNotaryKey();
    const m = makeNotaryKey();
    const dir = secrets({ devnet: `${d.secret}\n`, mainnet: `${m.secret}\n` });
    const dev = loadNotary({ SOLANA_CLUSTER: "devnet" }, dir);
    expect(dev.status === "on" && [dev.key.cluster, dev.key.address]).toEqual(["devnet", d.address]);
    const main = loadNotary({ SOLANA_CLUSTER: "mainnet" }, dir);
    expect(main.status === "on" && [main.key.cluster, main.key.address]).toEqual(["mainnet", m.address]);
    // A devnet key alone never signs on mainnet, nor a mainnet key alone on devnet; an empty file is no key.
    expect(loadNotary({ SOLANA_CLUSTER: "mainnet" }, secrets({ devnet: d.secret, mainnet: "" }))).toEqual({ status: "off", reason: "No key in notary-mainnet.key: the notary is off" });
    expect(loadNotary({ SOLANA_CLUSTER: "devnet" }, secrets({ mainnet: m.secret }))).toEqual({ status: "off", reason: "No key in notary-devnet.key: the notary is off" });
  });

  it("the same key on both networks is refused", () => {
    const k = makeNotaryKey();
    expect(loadNotary({ SOLANA_CLUSTER: "devnet" }, secrets({ devnet: k.secret, mainnet: k.secret }))).toEqual({
      status: "off",
      reason: "notary-devnet.key and notary-mainnet.key hold the same key: each network needs its own",
    });
  });

  it("a key in an environment variable is never read, and stops the notary until it is taken out", () => {
    const k = makeNotaryKey();
    const env: Record<string, string | undefined> = { SOLANA_CLUSTER: "devnet", NOTARY_KEY_DEVNET: k.secret, NOTARY_KEY_MAINNET: "x" };
    const loaded = loadNotary(env, secrets({ devnet: makeNotaryKey().secret }));
    expect(loaded).toEqual({ status: "off", reason: "NOTARY_KEY_DEVNET and NOTARY_KEY_MAINNET found in the environment: a key never goes there, only in deploy/secrets (docs/deploy.md)" });
    expect(Object.keys(env)).toEqual(["SOLANA_CLUSTER"]);
  });

  it("a file the server cannot read is said so, without its content", () => {
    if (process.getuid?.() === 0) return; // root reads everything: nothing to see here.
    const dir = secrets({ devnet: makeNotaryKey().secret });
    chmodSync(join(dir, KEY_FILES.devnet), 0o000);
    expect(loadNotary({ SOLANA_CLUSTER: "devnet" }, dir)).toEqual({ status: "off", reason: "notary-devnet.key cannot be read by the server: it must belong to the user 1000 (docs/deploy.md)" });
  });

  it("a key that is not one is refused without its value being said", () => {
    const k = makeNotaryKey();
    const bytes = base58Decode(k.secret)!;
    const wrongPublic = Uint8Array.from(bytes);
    wrongPublic[63] = wrongPublic[63]! ^ 1;
    const bad = [k.address, k.secret.slice(0, -2), base58Encode(wrongPublic), `${k.secret}0`, "0".repeat(88), JSON.stringify([...bytes])];
    for (const text of bad) {
      const loaded = loadNotary({ SOLANA_CLUSTER: "devnet" }, secrets({ devnet: text }));
      expect(loaded.status).toBe("off");
      expect(JSON.stringify(loaded)).not.toContain(text);
      expect(JSON.stringify(loaded)).toContain("notary-devnet.key does not hold a notary key");
    }
  });

  it("signs a seal, and only a seal, like the key it was made from, and shows nothing of the key when printed", () => {
    const k = makeNotaryKey();
    const loaded = loadNotary({ SOLANA_CLUSTER: "devnet" }, secrets({ devnet: `${k.secret}\n` }));
    if (loaded.status !== "on") throw new Error(loaded.reason);
    const sealed = loaded.key.signSeal(new Uint8Array(32).fill(9), "brinelight proof v1 2026-10-22 00");
    const tx = readMemoTransaction(sealed.tx)!;
    expect([tx.signer, tx.memo]).toEqual([k.address, "brinelight proof v1 2026-10-22 00"]);
    expect(verifyEd25519(base58Decode(k.address)!, tx.message, sealed.signature)).toBe(true);
    // It signs nothing else: the key has no other way out.
    expect(Object.keys(loaded.key).sort()).toEqual(["address", "cluster", "publicKey", "signSeal"]);
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
  /**
   * A copy of the deploy folder's script with a deploy/.env, and a fake `docker` that runs the real keygen with this
   * repository's Node (as the container would), fails, or answers something else. SERVER_UID is this test's own user.
   */
  function setUp(docker: "keygen" | "fail" | "junk" = "keygen") {
    const dir = mkdtempSync(join(tmpdir(), "notary-key-"));
    dirs.push(dir);
    cpSync(join(ROOT, "deploy/notary-key.sh"), join(dir, "notary-key.sh"));
    writeFileSync(join(dir, ".env"), "POSTGRES_PASSWORD=abc\nSOLANA_CLUSTER=devnet\n");
    const body =
      docker === "keygen"
        ? `exec node --import tsx "${join(ROOT, "server/src/proofs/keygen.ts")}"`
        : docker === "fail"
          ? "echo 'no such image' >&2; exit 1"
          : "echo 'Creating container'; echo 'address nope'";
    writeFileSync(join(dir, "docker"), `#!/usr/bin/env bash\ncd "${ROOT}"\n${body}\n`);
    chmodSync(join(dir, "docker"), 0o755);
    const uid = String(process.getuid?.() ?? 1000);
    return { dir, script: join(dir, "notary-key.sh"), env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, SERVER_UID: uid } };
  }
  const go = async (s: ReturnType<typeof setUp>, args: string[], extra: Record<string, string> = {}, bash: string[] = []) => {
    try {
      const r = await run("bash", [...bash, s.script, ...args], { env: { ...s.env, ...extra } });
      return { code: 0, out: r.stdout + r.stderr };
    } catch (e) {
      const err = e as { code: number; stdout: string; stderr: string };
      return { code: err.code, out: err.stdout + err.stderr };
    }
  };
  const keyOf = (s: ReturnType<typeof setUp>, cluster: "devnet" | "mainnet") => {
    const f = join(s.dir, "secrets", `notary-${cluster}.key`);
    return existsSync(f) ? readFileSync(f, "utf8") : null;
  };

  it("writes the key into secrets/notary-devnet.key (mode 600, its folder 700), never into .env, and shows only its address", async () => {
    const s = setUp();
    const r = await go(s, ["devnet"]);
    expect(r.code).toBe(0);
    const text = keyOf(s, "devnet")!;
    expect(text).toMatch(/^[1-9A-HJ-NP-Za-km-z]{80,90}\n$/);
    const secret = text.trim();
    expect(statSync(join(s.dir, "secrets/notary-devnet.key")).mode & 0o777).toBe(0o600);
    expect(statSync(join(s.dir, "secrets")).mode & 0o777).toBe(0o700);
    expect(readFileSync(join(s.dir, ".env"), "utf8")).toBe("POSTGRES_PASSWORD=abc\nSOLANA_CLUSTER=devnet\n");
    expect(r.out).not.toContain(secret);
    const loaded = loadNotary({ SOLANA_CLUSTER: "devnet" }, join(s.dir, "secrets"));
    if (loaded.status !== "on") throw new Error(loaded.reason);
    expect(r.out).toContain(`Its public address (you can share it): ${loaded.key.address}`);
  }, 30_000);

  it("fills the empty file update.sh made; never replaces a key; mainnet gets its own file and its own key", async () => {
    const s = setUp();
    mkdirSync(join(s.dir, "secrets"));
    writeFileSync(join(s.dir, "secrets/notary-devnet.key"), "");
    expect((await go(s, ["devnet"])).code).toBe(0);
    const once = keyOf(s, "devnet");
    const again = await go(s, ["devnet"]);
    expect(again.code).toBe(1);
    expect(again.out).toContain("A devnet key is already in deploy/secrets/notary-devnet.key: nothing was changed.");
    expect(keyOf(s, "devnet")).toBe(once);
    expect((await go(s, ["mainnet"])).code).toBe(0);
    expect(keyOf(s, "mainnet")).not.toBe(once);
    expect(keyOf(s, "mainnet")).toMatch(/^[1-9A-HJ-NP-Za-km-z]{80,90}\n$/);
  }, 60_000);

  it("run with bash -x, it still never shows the key", async () => {
    const s = setUp();
    const r = await go(s, ["devnet"], {}, ["-x"]);
    expect(r.code).toBe(0);
    expect(r.out).not.toContain(keyOf(s, "devnet")!.trim());
  }, 30_000);

  it("writes nothing when something is wrong", async () => {
    const plain = setUp();
    expect((await go(plain, [])).code).toBe(2);
    expect((await go(plain, ["testnet"])).code).toBe(2);
    const otherUser = await go(plain, ["devnet"], { SERVER_UID: "4242" });
    expect(otherUser.code).toBe(1);
    expect(otherUser.out).toContain("Run this as the user whose id is 4242");
    expect(keyOf(plain, "devnet")).toBeNull();
    const failing = setUp("fail");
    const f = await go(failing, ["devnet"]);
    expect(f.code).toBe(1);
    expect(f.out).toContain("The key could not be made");
    expect(keyOf(failing, "devnet")).toBeNull();
    const junk = setUp("junk");
    expect((await go(junk, ["devnet"])).code).toBe(1);
    expect(keyOf(junk, "devnet")).toBeNull();
  }, 30_000);
});
