import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For PR previews, use relative paths, for production use the repo name
  base: process.env.GITHUB_PAGES_BASE_PATH || "/",
});
