# Proceso de migraciones de base de datos

Una **migración** es un archivo SQL que cambia la estructura de la base (tablas, columnas,
permisos, funciones). Se aplican **una sola vez, en orden** y Supabase guarda cuáles ya
corrió en `supabase_migrations.schema_migrations`. El repositorio y la base deben decir lo mismo.

## Reglas

1. **Un cambio = un archivo nuevo** en `supabase/migrations/`, con nombre
   `AAAAMMDDHHMMSS_que_cambia.sql` (lo crea `npm run migration:new -- nombre`).
2. **Nunca se edita una migración ya aplicada.** Si algo quedó mal, se corrige con otra
   migración. `supabase/migrations.lock` guarda la huella de cada archivo y la revisión
   falla si alguien lo modifica.
3. **Solo hacia adelante y sin borrar.** Nada de `DROP`/`TRUNCATE` salvo que la línea diga
   `-- permitido: motivo` y se haya revisado (además, el conector de Supabase pide confirmación
   manual para borrar). Para retirar algo: primero dejar de usarlo en el código, luego borrarlo
   en una migración posterior.
4. **Compatibles con lo que está en producción.** Columnas nuevas con valor por defecto o
   nulas, funciones con `create or replace` manteniendo los parámetros. Así siguen funcionando
   a la vez el Feed Planner aislado, el clásico y el de BWO Engine.
5. **Toda tabla nueva activa RLS** en la misma migración (lo verifica la revisión).
6. Cada archivo explica **qué cambia, por qué y cómo se revertiría**.

## Flujo

```
npm run migration:new -- estadisticas_mensuales   # crea el archivo vacío con plantilla
# escribir el SQL
npm test                                          # revisa nombres, huellas, DROP y RLS
npm run migration:lock                            # registra la huella del archivo nuevo
git commit && git push                            # CI corre pruebas + build
```

Al llegar a `main`, el workflow **Migraciones** aplica lo pendiente con `supabase db push`
(cuando estén configurados los secretos `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD`).
Mientras tanto, las migraciones se aplican desde Claude con el conector de Supabase,
**con el mismo nombre de archivo**, y se verifica con `supabase migration list`.

## Estado actual

- Las 11 migraciones aplicadas tienen su archivo con la **misma versión** que el historial remoto.
- Las tablas originales del Feed Planner (anteriores a las migraciones) están documentadas en
  `supabase/schema/00_base_feed_planner.sql` para poder levantar una base de pruebas desde cero.
- Recomendado: una **rama de pruebas** de Supabase o un proyecto gratuito aparte para probar
  migraciones antes de producción.
