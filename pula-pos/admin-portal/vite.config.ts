import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This is the Master Admin Portal — a separate deployable app from the
// customer POS. Deploy it to its own subdomain (e.g. admin.yourdomain.com)
// so customers never see or reach it.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: { outDir: "dist", sourcemap: true },
});
