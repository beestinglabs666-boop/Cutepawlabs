import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // During local dev, proxy /api/* to Vercel dev server on 3000
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  build: { outDir: "dist" },
});
