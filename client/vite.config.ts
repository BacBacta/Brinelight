import { defineConfig } from "vite";
import { previewBuild } from "./src/preview.js";

export default defineConfig(({ mode }) => ({
  server: { port: 5173 },
  // A branch preview's build (Cloudflare Pages, not main): ?demo works there (src/demo.ts), never in production.
  define: {
    "import.meta.env.VITE_BRANCH_PREVIEW": JSON.stringify(previewBuild(process.env) ? "1" : ""),
    // The portal edition, Hold the Light (docs/design/hold-the-light.md): `vite build --mode portal`.
    "import.meta.env.VITE_PORTAL": JSON.stringify(mode === "portal" ? "1" : ""),
  },
  build: {
    outDir: "dist",
    target: "es2022",
    rollupOptions: {
      output: {
        // three.js in its own file: it changes rarely, so browsers keep it cached across game updates.
        manualChunks: (id) => (id.includes("/node_modules/three/") ? "three" : undefined),
      },
    },
  },
}));
