// Genera las páginas HTML de los recursos de BigWay.
// Uso: node build.mjs
import { writeFileSync } from "node:fs";

const BRAND = "BigWay";

const TOOLS = [
  { file: "calculadora-precios-whatsapp.html", nav: "Calculadora de precios", short: "Calculadora de precios", desc: "Estima el costo mensual de la API de WhatsApp Business según tu país y tus mensajes." },
  { file: "generador-enlace-whatsapp.html", nav: "Enlace de WhatsApp", short: "Generador de enlaces", desc: "Crea enlaces wa.me con mensaje prellenado y una versión para cada canal." },
  { file: "codigo-qr-whatsapp.html", nav: "QR de WhatsApp", short: "Código QR de WhatsApp", desc: "Un QR personalizado que abre tu chat, con cartel listo para imprimir." },
  { file: "generador-codigos-qr.html", nav: "Generador de QR", short: "Generador de códigos QR", desc: "QR para enlaces, correo, Wi-Fi, contacto, llamadas, SMS y texto." }
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = (s) => s.replace(/<[^>]+>/g, "");

function layout(p) {
  const nav = TOOLS.map((t) => `<a href="${t.file}"${t.file === p.file ? ' aria-current="page"' : ""}>${t.nav}</a>`).join("");
  const faqLd = p.faq ? {
    "@type": "FAQPage",
    mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: strip(a) } }))
  } : null;
  const appLd = p.file === "index.html" ? null : {
    "@type": "WebApplication", name: p.h1, description: p.desc, applicationCategory: "BusinessApplication",
    operatingSystem: "Cualquier navegador moderno", inLanguage: "es", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: BRAND }
  };
  const ld = { "@context": "https://schema.org", "@graph": [appLd, faqLd].filter(Boolean) };
  const related = TOOLS.filter((t) => t.file !== p.file).map((t) => `<a href="${t.file}"><b>${t.short}</b><span>${t.desc}</span></a>`).join("");

  const faq = p.faq ? `<section aria-labelledby="faq-t"><h2 id="faq-t">Preguntas frecuentes</h2><div class="faq">${p.faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div></section>` : "";
  const cols = p.cols ? `<section aria-labelledby="info-t"><h2 id="info-t">${p.colsTitle}</h2><div class="cols">${p.cols.map(([t, d]) => `<div class="col"><h3>${t}</h3><p>${d}</p></div>`).join("")}</div></section>` : "";
  const steps = p.steps ? `<section aria-labelledby="how-t"><h2 id="how-t">${p.stepsTitle}</h2><ol class="steps">${p.steps.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join("")}</ol></section>` : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:locale" content="es_LA">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0d1b3a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/styles.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#herramienta">Saltar a la herramienta</a>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="index.html" aria-label="${BRAND}: recursos gratuitos"><span class="logo-mark" aria-hidden="true"></span>${BRAND}</a>
    <nav class="nav" aria-label="Herramientas">${nav}</nav>
    <a class="btn small header-cta" data-contact href="#contacto">Contactar</a>
  </div>
</header>
<main>
  <div class="wrap">
    <section class="intro">
      <div class="crumbs"><a href="index.html">Recursos gratuitos</a>${p.file === "index.html" ? "" : " / " + esc(p.crumb)}</div>
      <h1>${p.h1}</h1>
      <p>${p.lead}</p>
    </section>
    <section id="herramienta" aria-label="Herramienta">
      ${p.app}
      <noscript><div class="panel">Esta herramienta necesita JavaScript activado en tu navegador.</div></noscript>
    </section>
  </div>
  <div class="content"><div class="wrap">
    ${cols}${steps}${faq}
    ${p.ctaTitle ? `<section class="cta-band" aria-labelledby="cta-t">
      <div><h2 id="cta-t">${p.ctaTitle}</h2><p>${p.ctaText}</p></div>
      <a class="btn" data-contact href="#contacto">Hablar con ${BRAND}</a>
    </section>` : ""}
    ${p.file === "index.html" ? "" : `<section aria-labelledby="rel-t"><h2 id="rel-t">Más herramientas gratuitas</h2><div class="related">${related}</div></section>`}
  </div></div>
</main>
<footer class="site-footer"><div class="wrap"><span>© ${new Date().getFullYear()} ${BRAND}. Herramientas gratuitas.</span><span>WhatsApp es una marca de Meta. ${BRAND} no está afiliado a Meta.</span></div></footer>
${p.scripts.map((s) => `<script src="assets/${s}"></script>`).join("\n")}
</body>
</html>
`;
}

const CTA_DEFAULT = {
  ctaTitle: "¿Quieres que WhatsApp venda por ti?",
  ctaText: "En BigWay conectamos WhatsApp con tu CRM y automatizamos respuestas, seguimiento y reportes para que ningún cliente se quede sin respuesta."
};

/* ---------------------------------------------------------------- */
const pages = [];

pages.push({
  file: "calculadora-precios-whatsapp.html",
  crumb: "Calculadora de precios de WhatsApp",
  title: "Calculadora de precios de WhatsApp Business API 2026 | BigWay",
  desc: "Calcula cuánto cuesta enviar mensajes por la API de WhatsApp Business según tu país. Tarifas de Meta vigentes en octubre de 2026, gratis y sin registro.",
  h1: "Calcula cuánto te cuesta WhatsApp Business",
  lead: "Elige el país de tus clientes, indica cuántos mensajes enviarás al mes y obtén el costo estimado con las tarifas de lista de Meta.",
  app: '<div id="calc-app"></div>',
  scripts: ["config.js", "common.js", "rates.js", "calc.js"],
  colsTitle: "Cómo cobra Meta los mensajes",
  cols: [
    ["Se paga por mensaje entregado", "Desde el 1 de julio de 2025 no se cobra por conversación. Cada plantilla entregada tiene su precio según la categoría y el país del cliente que la recibe."],
    ["La categoría define el precio", "Una plantilla de marketing puede costar varias veces más que una de utilidad. Escribir y clasificar bien tus plantillas es la forma más directa de bajar la factura."],
    ["Algunos mensajes no cuestan", "Lo que te escribe el cliente es gratis. Cada número incluye 1.000 mensajes de servicio al mes sin costo, y los anuncios de clic a WhatsApp abren una ventana gratuita."]
  ],
  stepsTitle: "Cómo usar la calculadora",
  steps: [
    ["Elige el país", "Selecciona donde vive la mayoría de tus clientes. Si atiendes varios países, calcula cada uno por separado y suma los resultados."],
    ["Indica tus mensajes del mes", "Escribe la cantidad de cada tipo o mueve el control deslizante. También puedes partir de uno de los ejemplos."],
    ["Revisa el desglose", "Verás cuánto pesa cada categoría, cuántos mensajes de servicio entran en el cupo gratuito y el costo anual."],
    ["Compártelo con tu equipo", "Copia el resumen, el enlace con tu estimación o descarga el CSV para presupuestos y propuestas."]
  ],
  faq: [
    ["¿Cómo se usa la calculadora de precios de WhatsApp?", "Elige el país donde está la mayoría de tus clientes, escribe cuántos mensajes de cada categoría esperas enviar al mes y la calculadora muestra el costo de Meta por categoría, el total mensual y el anual. Si tu proveedor te cobra una suscripción o un recargo por mensaje, puedes sumarlo en la sección opcional."],
    ["¿Qué diferencia hay entre plantillas de marketing, utilidad y autenticación?", "Las de <b>marketing</b> promocionan productos, ofertas o lanzamientos y siempre se cobran. Las de <b>utilidad</b> informan algo que el cliente ya pidió o contrató: confirmaciones, avisos de envío, recordatorios de pago. Las de <b>autenticación</b> envían códigos de un solo uso para verificar identidad."],
    ["¿Qué es un mensaje de servicio y cuánto cuesta?", "Es una respuesta libre, sin plantilla, que envías dentro de las 24 horas posteriores al último mensaje del cliente. Desde el 1 de octubre de 2026 cada número de WhatsApp Business incluye 1.000 al mes sin costo; del 1.001 en adelante se cobran al precio de utilidad del país del cliente."],
    ["¿Los mensajes que me envían mis clientes tienen costo?", "No. Todo lo que el cliente te escribe es gratis y no se descuenta de ningún cupo."],
    ["¿Qué es la ventana de atención de 24 horas?", "Se abre cada vez que un cliente te escribe y dura 24 horas desde su último mensaje. Dentro de ella puedes responder con mensajes libres. Cuando se cierra, solo puedes volver a contactarlo con una plantilla aprobada por Meta."],
    ["¿Hay mensajes gratis aparte del cupo de servicio?", "Sí. Si un cliente te escribe desde un anuncio de clic a WhatsApp o desde el botón de tu página de Facebook y respondes dentro de las primeras 24 horas, se abre una ventana gratuita de entrada (72 horas según la documentación de Meta que consultamos) en la que no pagas los mensajes. Esta calculadora no la descuenta."],
    ["¿Meta cobra por conversación?", "Ya no. Hasta junio de 2025 se cobraba por conversaciones de 24 horas. Desde el 1 de julio de 2025 el cobro es por mensaje de plantilla entregado."],
    ["¿Incluye los descuentos por volumen?", "No. Muestra la tarifa de lista. Meta reduce el precio de utilidad y autenticación cuando superas ciertos volúmenes mensuales en un mismo mercado, así que tu costo real puede ser menor. Marketing no tiene descuentos por volumen."],
    ["¿Cada cuánto cambian las tarifas?", "Meta solo puede actualizarlas el primer día de cada trimestre (1 de enero, abril, julio u octubre) y debe avisar con al menos un mes de anticipación. Las de esta calculadora rigen desde el 1 de octubre de 2026; confirma siempre en la documentación oficial de Meta antes de presupuestar."],
    ["¿Qué cobra mi proveedor además de Meta?", "Meta factura las tarifas por mensaje. Tu CRM o proveedor oficial de la API puede sumar una suscripción mensual, un recargo por mensaje o ambos. Pídele esas tarifas por escrito y compáralas en la sección opcional de la calculadora."],
    ["¿Necesito registrar un método de pago?", "Para los primeros 1.000 mensajes de servicio de cada número no hace falta. A partir del 1.001, Meta exige un método de pago en su centro de facturación para que esos mensajes sigan entregándose."]
  ],
  ...CTA_DEFAULT
});

pages.push({
  file: "generador-enlace-whatsapp.html",
  crumb: "Generador de enlaces de WhatsApp",
  title: "Generador de enlaces de WhatsApp (wa.me) gratis",
  desc: "Crea un enlace de WhatsApp con tu número y un mensaje prellenado. Genera un enlace distinto por canal, copia el código para tu web y conviértelo en QR.",
  h1: "Crea un enlace de WhatsApp con mensaje prellenado",
  lead: "Escribe tu número y, si quieres, el mensaje con el que te escribirán. En un toque tus clientes abren el chat contigo.",
  app: '<div id="link-app"></div>',
  scripts: ["config.js", "common.js", "link.js"],
  colsTitle: "Por qué usar un enlace de WhatsApp",
  cols: [
    ["El chat se abre en un toque", "Tu cliente no tiene que guardar tu número ni buscarte. Toca el enlace y ya está escribiéndote, con el mensaje listo para enviar."],
    ["Sabes de dónde llegan", "Crea un enlace por canal con un mensaje distinto. Así distingues a quien viene de Instagram, de un anuncio o de tu firma de correo."],
    ["Sirve en cualquier lugar", "Pégalo en tu biografía de Instagram, un botón de tu web, un anuncio, un correo, un video o conviértelo en un código QR."]
  ],
  stepsTitle: "Cómo crear tu enlace",
  steps: [
    ["Escribe tu número", "Elige el país y escribe el número con WhatsApp, sin el 0 inicial ni el +."],
    ["Añade un mensaje (opcional)", "Una frase corta como “Hola, quiero cotizar” hace que escribirte sea más fácil y te dice qué necesita el cliente."],
    ["Copia el enlace o el de tu canal", "Usa el enlace general o copia el específico para Instagram, anuncios, web y más."],
    ["Pruébalo antes de publicarlo", "Toca “Probar el enlace” para confirmar que abre el chat correcto con el mensaje esperado."]
  ],
  faq: [
    ["¿Qué es un enlace de WhatsApp?", "Es una dirección web que abre directamente una conversación con tu número. Tiene la forma wa.me/ seguido de tu número con código de país, y puede incluir un mensaje ya escrito."],
    ["¿Cómo creo mi enlace de WhatsApp?", "Elige tu país, escribe tu número en el formulario y, si quieres, un mensaje inicial. El enlace aparece al instante y puedes copiarlo o probarlo."],
    ["¿Debo escribir el número con el signo + o con ceros?", "No. Escríbelo sin el + y sin ceros al inicio; el código de país lo añade el selector. Si pegas un número internacional completo, detectamos el país por ti."],
    ["¿Para qué sirve el mensaje prellenado?", "Rompe el hielo: el cliente solo toca “enviar”. Además te dice qué necesita y, si usas un texto distinto por canal, te permite identificar de dónde llegó."],
    ["¿Puedo crear varios enlaces?", "Sí, todos los que quieras y gratis. Crear uno por canal o por campaña con su propio mensaje es una forma sencilla de ordenar los chats entrantes."],
    ["¿Cuál es la diferencia entre wa.me y api.whatsapp.com?", "Ambos abren el mismo chat. wa.me es más corto y es el formato más usado; api.whatsapp.com/send es la forma larga equivalente. Elige el que prefieras."],
    ["¿El enlace funciona si el cliente no tiene mi contacto guardado?", "Sí. Abre el chat contigo sin necesidad de agregarte antes a sus contactos."],
    ["¿Qué pasa si el número está mal escrito?", "WhatsApp muestra un aviso de que el número no está en WhatsApp o no es válido. Por eso conviene probar el enlace antes de publicarlo."],
    ["¿Cómo elimino un enlace?", "No hace falta: simplemente deja de usarlo. Los enlaces no caducan ni se registran en ningún servidor; se generan en tu navegador."],
    ["¿Puedo convertirlo en un código QR?", "Sí. Usa el botón “Convertir en código QR” y llevarás tu número y mensaje ya cargados."]
  ],
});

pages.push({
  file: "codigo-qr-whatsapp.html",
  crumb: "Código QR de WhatsApp",
  title: "Generador de código QR de WhatsApp gratis",
  desc: "Crea un código QR que abre tu chat de WhatsApp con un mensaje listo. Personaliza colores, forma y logo; descarga PNG, JPG o SVG y un cartel imprimible.",
  h1: "Crea un código QR para que te escriban por WhatsApp",
  lead: "Pon tu número y el mensaje inicial. Descarga el QR o un cartel A5 listo para el mostrador, el menú o el empaque.",
  app: '<div id="qr-app"></div><script>window.QR_STUDIO={types:["whatsapp"],initial:"whatsapp",poster:true};</script>',
  scripts: ["config.js", "qr-lib.js", "common.js", "qr-studio.js"],
  colsTitle: "Convierte lo físico en conversaciones",
  cols: [
    ["Del mundo físico al chat", "Un QR en tu vitrina, menú, factura o empaque permite que el cliente te escriba sin buscar tu número ni escribirlo."],
    ["Un QR por punto de contacto", "Crea un código distinto, con su propio mensaje, para cada lugar. Cuando llegue el chat sabrás si vino del mostrador, del empaque o de un volante."],
    ["Pensado para imprimir", "Elige colores, forma y logo, descarga en SVG para gran formato o saca el cartel A5 en un clic."]
  ],
  stepsTitle: "Cómo crear tu QR de WhatsApp",
  steps: [
    ["Escribe tu número y tu mensaje", "El mensaje aparecerá ya escrito en el chat del cliente al escanear."],
    ["Dale tu estilo", "Cambia colores, forma de los puntos y esquinas, y sube tu logo. Mantén buen contraste entre el código y el fondo."],
    ["Pruébalo con tu celular", "Escanéalo desde la pantalla y, si lo vas a imprimir, también desde una impresión de prueba."],
    ["Descarga y publica", "PNG para pantallas, SVG para impresión grande o el cartel A5 con tu título y tu negocio."]
  ],
  faq: [
    ["¿Cómo creo un código QR de WhatsApp?", "Escribe tu número de WhatsApp en el formulario y, si quieres, un mensaje inicial. El código aparece al instante y puedes personalizarlo y descargarlo."],
    ["¿Qué tamaño debo imprimirlo?", "Como mínimo 2 × 2 cm, aunque 3 cm o más es lo ideal. Cuanto más texto lleve el mensaje, más denso es el código y más grande debe imprimirse. El indicador de densidad te avisa."],
    ["¿Caduca el código QR?", "No. Es un QR estático: contiene tu enlace de WhatsApp directamente, así que funciona mientras tu número siga activo."],
    ["¿Puedo cambiar el mensaje después de imprimirlo?", "No, porque el mensaje va dentro del código. Si necesitas otro texto, genera un QR nuevo. Si quieres poder cambiarlo sin reimprimir, necesitarás un QR dinámico con redirección."],
    ["¿Puedo poner mi logo y mis colores?", "Sí. Cambia colores, forma de puntos y esquinas, y sube tu logo. Con logo activamos la máxima corrección de errores. Mantén el código oscuro sobre un fondo claro para que lo lean todos los celulares."],
    ["¿Qué formato descargo: PNG, JPG o SVG?", "PNG para pantallas, redes y documentos; JPG si el destino no admite PNG; SVG para impresión en gran formato, porque no pierde calidad al ampliarse."],
    ["¿Cuántos códigos puedo crear?", "Todos los que quieras, gratis. Un QR por punto de contacto, con su propio mensaje, ayuda a saber qué canal te trae más conversaciones."],
    ["¿Mis datos se guardan en algún servidor?", "No. El código se genera en tu navegador; tu número y tu mensaje no se envían ni se almacenan."],
    ["¿Puedo crear un enlace de WhatsApp en lugar de un QR?", "Sí, con el generador de enlaces de WhatsApp de esta misma página de recursos."]
  ],
});

pages.push({
  file: "generador-codigos-qr.html",
  crumb: "Generador de códigos QR",
  title: "Generador de códigos QR gratis: URL, WhatsApp, Wi-Fi y más",
  desc: "Genera códigos QR gratis para enlaces, WhatsApp, correo, Wi-Fi, contactos, llamadas, SMS y texto. Personaliza el diseño y descarga PNG, JPG o SVG.",
  h1: "Genera códigos QR gratis para tu negocio",
  lead: "Elige qué quieres compartir, personaliza el diseño y descarga tu QR en alta resolución. Sin registro y sin marcas de agua.",
  app: '<div id="qr-app"></div><script>window.QR_STUDIO={types:["url","whatsapp","email","text","wifi","vcard","phone","sms"],initial:"url",poster:false};</script>',
  scripts: ["config.js", "qr-lib.js", "common.js", "qr-studio.js"],
  colsTitle: "Un generador, ocho usos",
  cols: [
    ["Todo en un solo lugar", "Enlaces, WhatsApp, correo, texto, Wi-Fi, tarjeta de contacto, llamada y SMS. Cambia de tipo sin perder lo que escribiste."],
    ["Se genera en tu navegador", "Lo que escribes nunca sale de tu equipo. No guardamos tus códigos ni tus datos, y tampoco necesitas una cuenta."],
    ["Sin caducidad ni límites", "Son códigos estáticos: funcionan para siempre, sin cuota mensual ni marca de agua. Para enlaces web puedes añadir parámetros UTM y medir escaneos."]
  ],
  stepsTitle: "Cómo generar un código QR",
  steps: [
    ["Elige el tipo de QR", "Enlace web, WhatsApp, correo, texto, Wi-Fi, contacto, llamada o SMS."],
    ["Completa los datos", "Solo los campos del tipo elegido. Para enlaces web puedes activar los parámetros UTM para medir."],
    ["Personaliza el diseño", "Colores, forma de puntos y esquinas, margen y logo central. El aviso de contraste te ayuda a mantenerlo legible."],
    ["Descarga en el formato que necesites", "PNG, JPG o SVG en el tamaño que elijas. Pruébalo con tu celular antes de imprimirlo."]
  ],
  faq: [
    ["¿Qué es un código QR?", "Es un código de barras en dos dimensiones que se lee con la cámara del celular. Sirve para abrir un sitio web, iniciar un chat, conectarse a una red Wi-Fi, guardar un contacto o mostrar un texto sin tener que escribir nada."],
    ["¿Cómo genero un código QR?", "Elige el tipo, completa los datos que te pide, ajusta el diseño si quieres y descarga el archivo en PNG, JPG o SVG."],
    ["¿Qué tipos de código QR puedo crear?", "Enlace web, WhatsApp, correo electrónico, texto, red Wi-Fi, tarjeta de contacto (vCard), llamada telefónica y SMS."],
    ["¿Es gratis? ¿Tiene marca de agua o caduca?", "Es gratis, sin marca de agua y sin caducidad. Son códigos estáticos: el contenido va dentro de la imagen, así que funcionan mientras el destino exista."],
    ["¿Los clientes necesitan una aplicación para escanearlo?", "No. La cámara de la mayoría de los celulares actuales lee códigos QR directamente."],
    ["¿Qué formato elijo: PNG, JPG o SVG?", "PNG para pantallas y documentos; JPG si el destino no admite PNG; SVG para impresión en gran formato, porque se amplía sin perder nitidez."],
    ["¿Puedo medir cuántas personas escanean mi QR?", "En códigos de enlace web puedes activar los parámetros UTM y ver las visitas en Google Analytics. Para WhatsApp, usa un mensaje inicial distinto por cada QR y cuenta los chats por mensaje."],
    ["¿Se guardan mis datos?", "No. El código se genera en tu navegador y lo que escribes no se envía a ningún servidor."],
    ["¿Por qué mi QR no se escanea bien?", "Casi siempre es por poco contraste, por un margen muy pequeño, por demasiado contenido o por un tamaño de impresión muy reducido. Usa un código oscuro sobre fondo claro, deja margen y pruébalo antes de imprimir."]
  ],
});

for (const p of pages) writeFileSync(p.file, layout(p));

/* ---------------- Hub ---------------- */
const hub = {
  file: "index.html",
  title: "Herramientas gratuitas de WhatsApp y códigos QR | BigWay",
  desc: "Calculadora de precios de WhatsApp Business, generador de enlaces y códigos QR de WhatsApp, y generador de QR gratis. Hechas por BigWay.",
  h1: "Herramientas gratuitas para vender más por WhatsApp",
  lead: "Calcula tus costos, crea enlaces y códigos QR para que tus clientes te escriban. Todo gratis, sin registro y funcionando en tu navegador.",
  app: `<div class="hub">${TOOLS.map((t, i) => `<a href="${t.file}"><span class="tag">${["Presupuesto", "Captación", "Captación", "Utilidades"][i]}</span><h2>${t.short}</h2><p>${t.desc}</p></a>`).join("")}</div>`,
  scripts: ["config.js", "common.js"],
  ...CTA_DEFAULT
};
writeFileSync("index.html", layout(hub));
console.log("Generadas:", ["index.html", ...pages.map((p) => p.file)].join(", "));
