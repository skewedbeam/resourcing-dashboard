import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: set this to "/<your-repo-name>/" before deploying to GitHub Pages.
// If you deploy to a custom domain or to <username>.github.io root repo, set it to "/".
export default defineConfig({
  plugins: [react()],
  base: "/resourcing-dashboard/",
});
