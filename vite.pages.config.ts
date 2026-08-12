import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const loadedEnvironment = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_");
  const publicAdminEnvironment = {
    NEXT_PUBLIC_ADMIN_DATA_MODE:
      process.env.NEXT_PUBLIC_ADMIN_DATA_MODE ??
      loadedEnvironment.NEXT_PUBLIC_ADMIN_DATA_MODE ??
      "",
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      loadedEnvironment.NEXT_PUBLIC_SUPABASE_URL ??
      "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      loadedEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      "",
  };

  return {
    root: "github-pages",
    base: "/learning-platform-admin/",
    define: {
      __ADMIN_PUBLIC_ENV__: JSON.stringify(publicAdminEnvironment),
    },
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    plugins: [react()],
    build: {
      outDir: "../dist/pages",
      emptyOutDir: true,
    },
  };
});
