import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Identificador de la versión publicada (commit en Vercel), para agrupar errores por despliegue
const release = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || new Date().toISOString().slice(0, 16);

export default defineConfig({
  plugins: [react()],
  define: { __APP_RELEASE__: JSON.stringify(release) },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Librerías pesadas en trozos propios: se descargan solo al abrir el módulo que las usa
        manualChunks: { xlsx: ["xlsx"], charts: ["recharts"], supabase: ["@supabase/supabase-js"] },
      },
    },
  },
});
