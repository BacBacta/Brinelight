// client/vite.config.ts
import { defineConfig } from "file:///home/user/Brinelight/client/node_modules/vite/dist/node/index.js";
var vite_config_default = defineConfig({
  server: { port: 5173 },
  build: {
    outDir: "dist",
    target: "es2022",
    rollupOptions: {
      output: {
        // three.js in its own file: it changes rarely, so browsers keep it cached across game updates.
        manualChunks: (id) => id.includes("/node_modules/three/") ? "three" : void 0
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY2xpZW50L3ZpdGUuY29uZmlnLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvdXNlci9CcmluZWxpZ2h0L2NsaWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvdXNlci9CcmluZWxpZ2h0L2NsaWVudC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS91c2VyL0JyaW5lbGlnaHQvY2xpZW50L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgc2VydmVyOiB7IHBvcnQ6IDUxNzMgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6IFwiZGlzdFwiLFxuICAgIHRhcmdldDogXCJlczIwMjJcIixcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgLy8gdGhyZWUuanMgaW4gaXRzIG93biBmaWxlOiBpdCBjaGFuZ2VzIHJhcmVseSwgc28gYnJvd3NlcnMga2VlcCBpdCBjYWNoZWQgYWNyb3NzIGdhbWUgdXBkYXRlcy5cbiAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQpID0+IChpZC5pbmNsdWRlcyhcIi9ub2RlX21vZHVsZXMvdGhyZWUvXCIpID8gXCJ0aHJlZVwiIDogdW5kZWZpbmVkKSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzUSxTQUFTLG9CQUFvQjtBQUVuUyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixRQUFRLEVBQUUsTUFBTSxLQUFLO0FBQUEsRUFDckIsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsUUFBUTtBQUFBLElBQ1IsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUEsUUFFTixjQUFjLENBQUMsT0FBUSxHQUFHLFNBQVMsc0JBQXNCLElBQUksVUFBVTtBQUFBLE1BQ3pFO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
