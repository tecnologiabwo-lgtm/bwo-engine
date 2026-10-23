# Feed Planner · versión modular (v5)

## Instalación

1. **Base de datos** (una sola vez, en orden):
   - `migracion-v3.sql` si aún no lo corriste (portadas, fechas de aprobación, archivo).
   - `migracion-v4.sql` — bitácora de publicaciones.
   Supabase → SQL Editor → New query → pegar → Run.

2. **Despliegue**: arrastra **toda esta carpeta** a Vercel (debe subir `panel.html`, `cliente.html` y la carpeta `src/`).
   Entras en `.../panel`. El link de cada cliente sigue siendo `.../cliente.html?token=…`.

> Importante: al usar módulos ES, abrir `panel.html` con doble clic desde tu computadora **ya no funciona**
> (el navegador bloquea `import` en archivos locales). Prueba siempre en Vercel.

## Estructura

```
panel.html · cliente.html        páginas (solo montaje)
src/css/variables.css            TODOS los colores, tipografías y espaciados
src/css/base.css                 reset, botones, formularios, tarjetas, estados
src/css/components/*.css         un archivo por componente
src/js/config/                   env (claves), constantes de negocio
src/js/services/                 acceso a datos — nunca generan HTML
src/js/templates/                reciben datos y devuelven HTML — nunca consultan
src/js/controllers/              dragSort (arrastre), storyViewer (historias)
src/js/utils/                    fechas, formato, compresión de imágenes, helpers de UI
src/js/pages/panel/              una vista por archivo
```

## Migrar a Vite (cuando quieras)

1. `npm init -y && npm i -D vite`
2. Mover `panel.html` y `cliente.html` a la raíz (ya lo están) y declarar ambas entradas en `vite.config.js`.
3. En `src/js/config/env.js`, cambiar las constantes por `import.meta.env.VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y crear `.env` (en `.gitignore`) más `.env.example`.
4. `npm run build` → desplegar la carpeta `dist`.
No hay que tocar ningún otro archivo: las rutas de import son relativas y compatibles.
