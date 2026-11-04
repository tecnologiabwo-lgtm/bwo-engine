#!/usr/bin/env node
/* El Feed clásico (public/feed) no pasa por Vite: copiamos ahí los módulos
   compartidos para que las dos versiones usen exactamente la misma lógica. */
import { readFileSync, writeFileSync } from "node:fs";
const pairs = [["src/shared/lib/linkify.js", "public/feed/src/js/utils/linkify.js"]];
for (const [from, to] of pairs) {
  writeFileSync(to, "/* COPIA GENERADA desde " + from + " por scripts/sync-feed-shared.mjs — no editar aquí */\n" + readFileSync(from, "utf8"));
  console.log("sincronizado", to);
}
