import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
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
