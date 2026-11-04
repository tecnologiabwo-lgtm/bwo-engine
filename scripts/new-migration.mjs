#!/usr/bin/env node
/* Crea una migración con el formato de la CLI de Supabase: AAAAMMDDHHMMSS_nombre.sql
   Uso: npm run migration:new -- nombre_en_snake_case */
import { writeFileSync, existsSync } from "node:fs";
const name = (process.argv[2] || "").trim();
if (!/^[a-z0-9_]{3,60}$/.test(name)) { console.error("Nombre inválido: usa snake_case, p. ej. estadisticas_mensuales"); process.exit(1); }
const d = new Date(), p = (n) => String(n).padStart(2, "0");
const v = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
const file = `supabase/migrations/${v}_${name}.sql`;
if (existsSync(file)) { console.error("Ya existe", file); process.exit(1); }
writeFileSync(file, `-- ============================================================
--  ${name}
--  Qué cambia y por qué:
--  Reversión (escribir aquí cómo deshacerlo, sin ejecutarlo):
-- ============================================================

`);
console.log("Creada:", file);
