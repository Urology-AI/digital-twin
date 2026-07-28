import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Absolute asset URLs, required for deep-link routes like /patient/<id> —
  // with a relative base, a browser landing directly on that path would
  // resolve assets relative to /patient/ instead of the real root and 404.
  // (Previously "./" for hosting under an unknown subpath e.g. GitHub Pages;
  // not compatible with patient-link routing, so fixed to the real root.)
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
