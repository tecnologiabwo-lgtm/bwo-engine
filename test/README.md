# Pruebas automáticas del Consolidador

Ejecutar antes de cada despliegue:

    npm test

- `fuzz.mjs` fabrica exportaciones de Meta Ads con cientos de estructuras distintas
  (campaña / conjunto / anuncio, filas "All", celdas en blanco, desgloses a otro nivel,
  nombres repetidos entre niveles, profundidad mixta, resultados vacíos, sin impresiones,
  clics solo por CPC, encabezado en fila 0 o 2, ambos órdenes de carga) y compara cada
  cifra contra una verdad calculada de forma independiente.
- `series.mjs` genera paquetes de Instagram Insights / Facebook con métricas de título
  ambiguo, duplicados, meses sin solapar, asignaciones erróneas y sugerencias de plataforma.

- `organic.mjs` verifica el conteo semanal (lunes a domingo) de publicaciones de feed e
  historias contra una verdad por fuerza bruta: semanas recortadas al periodo, semanas sin
  publicaciones, archivos solo de historias o solo de feed, fechas fuera de rango y sin fecha.
- `fuzz.mjs` además genera el informe ejecutivo en cada escenario y comprueba que incluya
  todas las campañas / conjuntos / anuncios del nivel, una sección por entidad, y que el total
  de cada objetivo sea la suma exacta de sus entidades.

- `audience.mjs` verifica el archivo «Público»: columnas Hombres/Mujeres en cualquier orden,
  secciones en cualquier orden (incluidas listas de un solo país), y la separación
  Instagram / Facebook cuando llegan dos archivos de audiencia distintos.

Todas deben terminar en `FALLOS: 0`. Usan solo datos sintéticos (ningún dato de cliente).
