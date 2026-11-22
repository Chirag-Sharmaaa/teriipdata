import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), ["MASTER_TRACKER_", "SUPABASE_", "TERIIP_"]);
  for (const [key, value] of Object.entries(serverEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [
      tanstackStart(),
      netlify({ dev: { edgeFunctions: { enabled: false } } }),
      tsconfigPaths(),
      tailwindcss(),
      viteReact(),
    ],
    optimizeDeps: { noDiscovery: true, include: ["recharts", "lodash/get"] },
    server: { port: 8080, strictPort: true },
  };
});
