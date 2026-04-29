import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// We import scenarios directly from ../examples through Vite's import.meta.glob.
// To make that path resolvable in dev and build, expose the parent folder via fs.allow.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        path.resolve(__dirname, ".."),
        path.resolve(__dirname, "..", "examples"),
      ],
    },
  },
});
