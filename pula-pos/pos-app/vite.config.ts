import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds to a static bundle (HTML/CSS/JS) that can be hosted on any static
// web host / CDN — the customer only ever visits it in a browser.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: true },
});
