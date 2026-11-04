/* Catálogo del apartado "Herramientas". Las herramientas del kit de recursos
   viven como páginas estáticas en /recursos (también sirven como recursos
   públicos para atraer tráfico); aquí se integran en modo embebido. */
export const TOOLS = [
  { id: "precios-whatsapp", title: "Calculadora de precios de WhatsApp API", tag: "Presupuesto", icon: "whatsapp",
    desc: "Estima el costo mensual de la API de WhatsApp Business por país y tipo de mensaje (marketing, utilidad, servicio).",
    src: "/recursos/calculadora-precios-whatsapp.html", uses: ["Cotizar el Programa 05", "Justificar presupuesto de WhatsApp API"] },
  { id: "enlace-whatsapp", title: "Generador de enlaces de WhatsApp", tag: "Captación", icon: "whatsapp",
    desc: "Crea enlaces wa.me con mensaje prellenado y una variante por canal (bio, anuncios, correo, web) para medir de dónde llegan.",
    src: "/recursos/generador-enlace-whatsapp.html", uses: ["Enlace de la biografía", "CTA de anuncios de Meta"] },
  { id: "qr-whatsapp", title: "Código QR de WhatsApp", tag: "Captación", icon: "whatsapp",
    desc: "QR personalizado que abre el chat, con cartel A5 listo para imprimir en mostrador, stands o empaques.",
    src: "/recursos/codigo-qr-whatsapp.html", uses: ["Punto de venta", "Ferias y eventos"] },
  { id: "qr", title: "Generador de códigos QR", tag: "Utilidades", icon: "qr",
    desc: "QR para URL, correo, Wi-Fi, contacto (vCard), llamada, SMS, texto y WhatsApp, con colores y logo.",
    src: "/recursos/generador-codigos-qr.html", uses: ["Tarjetas de presentación", "Material impreso"] },
];
export const TAGS = ["Todas", ...new Set(TOOLS.map((t) => t.tag))];
export const toolById = (id) => TOOLS.find((t) => t.id === id);
