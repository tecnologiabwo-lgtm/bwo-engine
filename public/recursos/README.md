# Recursos gratuitos BigWay

Cuatro herramientas gratuitas en HTML/CSS/JS puro (sin servidor, sin base de datos) para atraer tráfico a la web de BigWay.

| Archivo | Herramienta |
|---|---|
| `index.html` | Portada del hub de recursos |
| `calculadora-precios-whatsapp.html` | Calculadora de precios de WhatsApp Business API |
| `generador-enlace-whatsapp.html` | Generador de enlaces wa.me (8 canales, snippets) |
| `codigo-qr-whatsapp.html` | QR de WhatsApp + cartel A5 |
| `generador-codigos-qr.html` | QR de URL, correo, texto, Wi-Fi, contacto, llamada, SMS, WhatsApp |

## Configuración (un solo archivo)
Edita `assets/config.js`:
- `whatsapp`: tu número con código de país, sin + (ej. `"584121234567"`). Si lo dejas vacío, los botones usan `contactUrl`.
- `contactUrl`: URL de tu página de contacto (por defecto `#contacto`).
- `ctaLabel`, `brand`, `ratesVerified`.

Colores y tipografías: variables CSS en `:root` de `assets/styles.css` (cobalto #1d4dff, azul marino #0d1b3a, ámbar #ffb020 son provisionales: cámbialos por tu paleta).

## Publicar
- **Hosting estático / subcarpeta** (`/recursos/`): sube la carpeta tal cual (sin `node_modules`, `build.mjs` ni `package.json`, que solo sirven para regenerar).
- **WordPress**: sube la carpeta por FTP a `/recursos/` y enlázala desde el menú; o pega el contenido del `<main>` de cada página en un bloque HTML personalizado y carga `assets/*.css|js` desde el tema.
- **Webflow / Wix**: usa un embed HTML (iframe) apuntando a la URL donde alojes la carpeta.
- Cambia el dominio en `<link rel="canonical">`, `og:url` y JSON-LD si no es el de BigWay (se genera en `build.mjs`).

## Regenerar las páginas
Los textos, FAQ y SEO viven en `build.mjs`. Tras editarlo: `npm install && node build.mjs`.

## Mantenimiento trimestral de tarifas
Meta cambia las tarifas el 1 de enero, abril, julio y octubre. Actualiza `assets/rates.js` (marketing, utilidad por país/región) y `ratesVerified` en `config.js`. Fuente: documentación de precios de WhatsApp Business Platform (developers.facebook.com/docs/whatsapp/pricing).

## Notas
- Todo corre en el navegador del visitante; no se envían datos a ningún servidor.
- Librería QR: `qrcode-generator` (MIT), empaquetada en `assets/qr-lib.js`.
- Los QR con puntos/esquinas circulares o logo funcionan en móviles; algunos decodificadores de laboratorio los leen peor. Prueba siempre antes de imprimir.
