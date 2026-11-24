import { defineConfig } from "vite";
import { resolve } from "node:path";
import { previewBuild } from "./src/preview.js";
import { PORTAL_DROPPED, PORTAL_OUT, dropFolders, portalTitle } from "./src/portal/build.js";

export default defineConfig(({ mode }) => ({
  server: { port: 5173 },
  // The portal: relative addresses (CrazyGames serves a game from a folder of its own), its title, no prototype.
  ...(mode === "portal" && {
    base: "./",
    plugins: [
      (() => {
        let out = "";
        return {
          name: "brinelight-portal",
          configResolved(c: { root: string; build: { outDir: string } }) {
            out = resolve(c.root, c.build.outDir);
          },
          transformIndexHtml: portalTitle,
          closeBundle() {
            dropFolders(out, PORTAL_DROPPED);
          },
        };
      })(),
    ],
  }),
  // A branch preview's build (Cloudflare Pages, not main): ?demo works there (src/demo.ts), never in production.
  define: {
    "import.meta.env.VITE_BRANCH_PREVIEW": JSON.stringify(previewBuild(process.env) ? "1" : ""),
    // The portal edition, Hold the Light (docs/design/hold-the-light.md): `vite build --mode portal`.
    "import.meta.env.VITE_PORTAL": JSON.stringify(mode === "portal" ? "1" : ""),
  },
  build: {
    outDir: mode === "portal" ? PORTAL_OUT : "dist",
    target: "es2022",
    rollupOptions: {
      output: {
        // three.js in its own file: it changes rarely, so browsers keep it cached across game updates.
        manualChunks: (id) => (id.includes("/node_modules/three/") ? "three" : undefined),
      },
    },
  },
}));
