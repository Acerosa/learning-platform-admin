import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "github-pages",
  base: "/learning-platform-admin/",
  plugins: [react()],
  build: {
    outDir: "../dist/pages",
    emptyOutDir: true,
  },
});
