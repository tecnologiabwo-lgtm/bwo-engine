import { requireUser } from "../_lib/auth.js";

/**
 * Endpoint único para los tres proveedores.
 * Se despliega como Serverless Function en Vercel (carpeta /api).
 * La clave nunca llega al navegador: vive en las variables de entorno del servidor.
 *
 * Variables requeridas (configura solo las que vayas a usar):
 *   ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY
 * Acceso: requiere sesión de Supabase con rol admin (agencia).
 *
 * Modelo abierto: se usa, en orden, el que llega en la petición, el de la
 * variable <PROVEEDOR>_MODEL o el valor por defecto de abajo.
 */

const MODELOS = {
  anthropic: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  google: process.env.GOOGLE_MODEL || "gemini-2.5-pro",
  openai: process.env.OPENAI_MODEL || "gpt-4.1",
};
const MODELO_VALIDO = /^[a-zA-Z0-9._:\-]{2,80}$/;

/* Límite de peticiones por IP, en memoria. Se reinicia con cada instancia:
   suficiente para frenar abuso casual, no sustituye a un rate limiter real. */
const ventana = new Map();
const LIMITE = 20;
const MINUTOS = 60;

function permitido(ip) {
  const ahora = Date.now();
  const previo = (ventana.get(ip) || []).filter((t) => ahora - t < MINUTOS * 60000);
  if (previo.length >= LIMITE) return false;
  previo.push(ahora);
  ventana.set(ip, previo);
  return true;
}

/* ---- adaptadores por proveedor ---- */

async function anthropic({ system, user, model }) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model, max_tokens: 2000, system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "Error de Anthropic");
  return d.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function google({ system, user, model }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 2000 },
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "Error de Google");
  return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("\n");
}

async function openai({ system, user, model }) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model, max_tokens: 2000,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "Error de OpenAI");
  return d.choices?.[0]?.message?.content || "";
}

const ADAPTADORES = { anthropic, google, openai };

/* ---- el prompt: nuestros 7 bloques, comprimidos ---- */

const SYSTEM = `Eres analista senior de medios pagados en una agencia. Redactas para el cliente que financia la pauta: un decisor de negocio, no un técnico.

REGLAS INNEGOCIABLES
1. Trabaja EXCLUSIVAMENTE con las cifras del JSON. Si un dato no está, escribe "sin datos" y di qué exportación lo habilitaría. Nunca estimes, promedies ni inventes.
2. Nunca cites benchmarks de industria. La única comparación válida es contra los propios periodos anteriores de esta cuenta.
3. Cada afirmación lleva su cifra y su periodo. Conclusión primero, evidencia después.
4. Nunca presentes coincidencia temporal como causalidad.
5. Si el CTR proviene de clics totales y no de clics en el enlace, dilo explícitamente al usarlo.

PROHIBIDO: "resultados prometedores", "seguimos optimizando", "la campaña va bien", "insights valiosos", "potenciar la marca", emojis, y cualquier valoración sin cifra que la sostenga.

FORMATO DE SALIDA (Markdown, sin encabezado de nivel 1):
## Lectura del periodo
Tres frases. Qué se invirtió, qué se obtuvo, y el hecho más relevante.

## Hallazgos
Entre 4 y 6 viñetas. Máximo 25 palabras cada una, con la cifra crítica en negrita.

## Decisiones para el próximo ciclo
Entre 3 y 5 acciones ejecutables dentro de Ads Manager, en formato:
**Acción** → segmento o campaña afectada → métrica a vigilar

## Qué falta para afinar el análisis
Una o dos líneas sobre columnas o desgloses ausentes en la exportación.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST" });

  const ip = req.headers["x-real-ip"] || req.headers["x-forwarded-for"]?.split(",").at(-1)?.trim() || "anon";
  if (!permitido(ip)) {
    return res.status(429).json({ error: "Alcanzaste el límite de análisis por hora. Intenta más tarde." });
  }

  try { await requireUser(req, { admin: true }); }
  catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const { provider = "anthropic", model: pedido, metrics, question } = req.body || {};
  const model = pedido && MODELO_VALIDO.test(pedido) ? pedido : MODELOS[provider];

  const adaptador = ADAPTADORES[provider];
  if (!adaptador) return res.status(400).json({ error: `Proveedor no soportado: ${provider}` });

  const claves = { anthropic: "ANTHROPIC_API_KEY", google: "GOOGLE_API_KEY", openai: "OPENAI_API_KEY" };
  if (!process.env[claves[provider]]) {
    return res.status(400).json({ error: `Falta configurar ${claves[provider]} en el servidor.` });
  }
  if (!metrics) return res.status(400).json({ error: "No se recibieron métricas." });

  const user = [
    "Datos consolidados de la cuenta (JSON):",
    "```json",
    JSON.stringify(metrics),
    "```",
    question ? `\nPregunta específica del equipo: ${question}` : "",
  ].join("\n");

  try {
    const texto = await adaptador({ system: SYSTEM, user, model });
    return res.status(200).json({ texto, provider, model });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
