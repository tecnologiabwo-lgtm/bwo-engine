/* COPIA GENERADA desde src/shared/lib/linkify.js por scripts/sync-feed-shared.mjs — no editar aquí */
/* Convierte texto en fragmentos con enlaces seguros (solo http/https/mailto).
   Reconoce: URLs con o sin protocolo (bigway.com, www.x.com/ruta), correos,
   @usuario (Instagram) y #hashtag. Sin HTML: se usa desde React o desde el
   Feed clásico, que escapa el texto antes de insertar. Probado en test/linkify.mjs. */
const TLD = "(?:com|net|org|io|co|app|dev|ai|me|info|biz|shop|store|online|site|tech|es|mx|ve|ar|cl|pe|ec|uy|py|bo|do|pa|cr|gt|hn|sv|ni|cu|pr|us|uk|eu|link|ly|gl|to|tv|page)";
const RE = new RegExp(
  [
    "(?<email>[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+)",
    `(?<url>(?:https?:\\/\\/)[^\\s<>"']+|(?:www\\.)[^\\s<>"']+|\\b[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.${TLD}\\b(?:\\/[^\\s<>"']*)?)`,
    "(?<handle>(?:^|(?<=[\\s(]))@[a-z0-9._]{2,30})",
    "(?<tag>(?:^|(?<=[\\s(]))#[\\p{L}\\p{N}_]{2,60})",
  ].join("|"),
  "giu",
);
const TRAIL = /[.,;:!?)\]}»"']+$/;

export function safeHref(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const withProto = /^(https?:|mailto:)/i.test(s) ? s : /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(s) ? `mailto:${s}` : `https://${s.replace(/^\/+/, "")}`;
  try {
    const u = new URL(withProto);
    if (!["http:", "https:", "mailto:"].includes(u.protocol)) return null;
    if (u.protocol !== "mailto:" && !u.hostname.includes(".")) return null;
    return u.href;
  } catch { return null; }
}

/** → [{ type: "text"|"link", text, href? }] */
export function linkify(text) {
  const s = String(text ?? ""), out = [];
  let last = 0;
  for (const m of s.matchAll(RE)) {
    let tok = m[0], start = m.index;
    const g = m.groups;
    let href = null, trail = "";
    if (g.url || g.email) { const t = tok.match(TRAIL); if (t) { trail = t[0]; tok = tok.slice(0, -trail.length); } }
    if (g.email) href = safeHref(`mailto:${tok}`);
    else if (g.url) href = safeHref(tok);
    else if (g.handle) href = `https://www.instagram.com/${tok.slice(1).replace(/\.+$/, "")}/`;
    else if (g.tag) href = `https://www.instagram.com/explore/tags/${encodeURIComponent(tok.slice(1))}/`;
    if (!href) continue;
    if (start > last) out.push({ type: "text", text: s.slice(last, start) });
    out.push({ type: "link", text: tok, href });
    if (trail) out.push({ type: "text", text: trail });
    last = start + m[0].length;
  }
  if (last < s.length) out.push({ type: "text", text: s.slice(last) });
  return out;
}

export const displayUrl = (href) => String(href || "").replace(/^mailto:/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
