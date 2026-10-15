import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
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
});
