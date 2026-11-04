#!/usr/bin/env node
/* Revisión de migraciones (corre en npm test y en la integración continua).
   Reglas:
   1. Nombre AAAAMMDDHHMMSS_snake_case.sql y versiones únicas y crecientes.
   2. Una migración aplicada no se edita: el archivo debe coincidir con su huella
      en supabase/migrations.lock (se regenera con --update al crear una nueva).
   3. Nada destructivo (DROP, TRUNCATE) fuera de funciones, salvo que la línea
      lleve el comentario «-- permitido: motivo».
   4. Toda tabla nueva activa RLS en la misma migración. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = "supabase/migrations", lockFile = "supabase/migrations.lock";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const lock = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};
const errors = [], next = {};
let prev = "";
const strip = (s) => s.replace(/--.*$/gm, "").replace(/\$\$[\s\S]*?\$\$/g, "$$");   // sin comentarios ni cuerpos de funciones
for (const f of files) {
  const m = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(f);
  if (!m) { errors.push(`${f}: el nombre debe ser AAAAMMDDHHMMSS_snake_case.sql`); continue; }
  if (m[1] <= prev) errors.push(`${f}: versión repetida o fuera de orden`);
  prev = m[1];
  const sql = readFileSync(`${dir}/${f}`, "utf8");
  const hash = createHash("sha256").update(sql).digest("hex").slice(0, 16);
  next[f] = hash;
  if (lock[f] && lock[f] !== hash) errors.push(`${f}: fue editada después de aplicarse. Crea una migración nueva en vez de modificarla.`);
  sql.split("\n").forEach((line, i) => {
    if (/--\s*permitido:/i.test(line)) return;
    const code = strip(line);
    if (/\b(drop|truncate)\b/i.test(code)) errors.push(`${f}:${i + 1}: sentencia destructiva sin «-- permitido: motivo»`);
  });
  const body = strip(sql);
  for (const t of body.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)) {
    if (!new RegExp(`alter table (?:public\\.)?${t[1]} enable row level security`, "i").test(body)) errors.push(`${f}: la tabla ${t[1]} no activa RLS`);
  }
}
if (process.argv.includes("--update")) { writeFileSync(lockFile, JSON.stringify(next, null, 2) + "\n"); console.log("migrations.lock actualizado"); }
if (errors.length) { console.log(errors.map((e) => "✗ " + e).join("\n")); console.log(`MIGRACIONES · ${files.length} archivos · FALLOS: ${errors.length}`); process.exit(1); }
console.log(`MIGRACIONES · ${files.length} archivos · FALLOS: 0`);
