/* Estudio de códigos QR: WhatsApp, URL, correo, texto, Wi-Fi, contacto, llamada y SMS */
(function () {
  "use strict";
  const { el, $, $$, debounce, toast, copyText, downloadBlob, slug, PhoneField, waLink, contrast, makeQR, qrSvg, svgToCanvas, canvasBlob, qrDensity, CFG, contactHref } = BW;
  const root = $("#qr-app");
  if (!root) return;
  const cfg = Object.assign({ types: ["whatsapp"], initial: "whatsapp", poster: false }, window.QR_STUDIO || {});
  let uid = 0;

  /* ---------- helpers de formulario ---------- */
  function field(label, control, hint) {
    if (!control.id) control.id = "qf" + (++uid);
    const f = el("div", { class: "field" }, [el("label", { for: control.id, text: label }), control]);
    if (hint) f.appendChild(el("div", { class: "hint", text: hint }));
    return f;
  }
  const input = (attrs) => el("input", Object.assign({ class: "input" }, attrs || {}));
  const textarea = (attrs) => el("textarea", Object.assign({ class: "textarea" }, attrs || {}));
  const esc = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");
  const vesc = (s) => String(s).replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
  const bright = (hex) => { hex = hex.replace("#", ""); const n = parseInt(hex.length === 3 ? hex.split("").map((x) => x + x).join("") : hex, 16); return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114; };

  function phoneBlock(label, hint) {
    const holder = el("div", { class: "field" });
    const lab = el("label", { text: label });
    holder.appendChild(lab);
    const host = el("div"); holder.appendChild(host);
    const pf = PhoneField(host, { placeholder: "Número de teléfono" });
    pf.input.id = "qf" + (++uid); lab.setAttribute("for", pf.input.id);
    if (hint) holder.appendChild(el("div", { class: "hint", text: hint }));
    return { node: holder, pf: pf };
  }

  /* ---------- definiciones de tipo ---------- */
  const TYPES = {
    whatsapp: {
      label: "WhatsApp",
      build(box) {
        const ph = phoneBlock("Número de WhatsApp", "Sin el 0 inicial ni el +. Si pegas un número internacional completo, detectamos el país.");
        const msg = textarea({ maxlength: "300", placeholder: "Hola, quiero información sobre sus servicios." });
        const cnt = el("div", { class: "count", text: "0 / 300" });
        const f = field("Mensaje inicial (opcional)", msg, "Es el texto que aparecerá escrito en el chat del cliente.");
        f.insertBefore(cnt, f.querySelector(".hint"));
        msg.addEventListener("input", () => { cnt.textContent = msg.value.length + " / 300"; });
        box.appendChild(ph.node); box.appendChild(f);
        return {
          read() {
            const r = ph.pf.read(); ph.pf.showError(r.error);
            if (!r.ok) return { ok: false, payload: "", name: "whatsapp" };
            return { ok: true, payload: waLink(r.digits, msg.value), name: "whatsapp-" + r.digits, link: waLink(r.digits, msg.value), digits: r.digits, text: msg.value };
          },
          prefill(q) { if (q.get("phone")) ph.pf.set(q.get("phone")); if (q.get("text")) { msg.value = q.get("text").slice(0, 300); cnt.textContent = msg.value.length + " / 300"; } }
        };
      }
    },
    url: {
      label: "Enlace web",
      build(box) {
        const url = input({ type: "url", placeholder: "https://tuweb.com/oferta", inputmode: "url", autocomplete: "off" });
        const err = el("div", { class: "err", "aria-live": "polite" });
        const f = field("Dirección web", url, "Puedes pegar cualquier enlace: tu web, un menú, un video, una ubicación de Maps.");
        f.appendChild(err);
        const utmOn = el("input", { type: "checkbox", style: "width:18px;height:18px;accent-color:var(--brand)" });
        const utmLabel = el("label", { style: "display:flex;gap:10px;align-items:center;font-weight:600;font-size:.93rem;margin-bottom:10px" }, [utmOn, "Medir los escaneos con parámetros UTM"]);
        const utm = el("div", { hidden: true });
        const us = input({ placeholder: "qr" }), um = input({ placeholder: "impreso" }), uc = input({ placeholder: "promo-noviembre" });
        utm.appendChild(el("div", { class: "row" }, [field("Fuente (utm_source)", us), field("Medio (utm_medium)", um)]));
        utm.appendChild(field("Campaña (utm_campaign)", uc, "Aparecerá en Google Analytics para saber cuántas visitas llegaron desde este QR."));
        utmOn.addEventListener("change", () => { utm.hidden = !utmOn.checked; });
        box.appendChild(f); box.appendChild(utmLabel); box.appendChild(utm);
        return {
          read() {
            let v = url.value.trim();
            err.textContent = ""; url.setAttribute("aria-invalid", "false");
            if (!v) return { ok: false, payload: "", name: "enlace" };
            if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v;
            let u;
            try { u = new URL(v); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw 0; } catch (_) {
              err.textContent = "Escribe una dirección válida, por ejemplo https://tuweb.com"; url.setAttribute("aria-invalid", "true");
              return { ok: false, payload: "", name: "enlace" };
            }
            if (utmOn.checked) {
              if (us.value.trim()) u.searchParams.set("utm_source", us.value.trim());
              if (um.value.trim()) u.searchParams.set("utm_medium", um.value.trim());
              if (uc.value.trim()) u.searchParams.set("utm_campaign", uc.value.trim());
            }
            return { ok: true, payload: u.toString(), name: slug(u.hostname), link: u.toString() };
          }
        };
      }
    },
    email: {
      label: "Correo",
      build(box) {
        const to = input({ type: "email", placeholder: "hola@tuempresa.com", autocomplete: "off" });
        const sub = input({ placeholder: "Quiero más información" });
        const body = textarea({ maxlength: "300", placeholder: "Escribe aquí el mensaje que se abrirá en el correo." });
        box.appendChild(field("Correo de destino", to)); box.appendChild(field("Asunto (opcional)", sub)); box.appendChild(field("Mensaje (opcional)", body));
        return {
          read() {
            const v = to.value.trim();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, payload: "", name: "correo" };
            const p = [];
            if (sub.value.trim()) p.push("subject=" + encodeURIComponent(sub.value.trim()));
            if (body.value.trim()) p.push("body=" + encodeURIComponent(body.value.trim()));
            return { ok: true, payload: "mailto:" + v + (p.length ? "?" + p.join("&") : ""), name: "correo" };
          }
        };
      }
    },
    text: {
      label: "Texto",
      build(box) {
        const t = textarea({ maxlength: "500", placeholder: "Cualquier texto: un código de cupón, una dirección, una nota…", style: "min-height:140px" });
        const cnt = el("div", { class: "count", text: "0 / 500" });
        const f = field("Texto", t);
        f.insertBefore(cnt, null);
        t.addEventListener("input", () => { cnt.textContent = t.value.length + " / 500"; });
        f.appendChild(cnt); box.appendChild(f);
        return { read() { const v = t.value; return v.trim() ? { ok: true, payload: v, name: "texto" } : { ok: false, payload: "", name: "texto" }; } };
      }
    },
    wifi: {
      label: "Wi-Fi",
      build(box) {
        const ssid = input({ placeholder: "Nombre de la red", autocomplete: "off" });
        const pass = input({ placeholder: "Contraseña", autocomplete: "off" });
        const sec = el("select", { class: "select" }, [el("option", { value: "WPA", text: "WPA / WPA2 / WPA3" }), el("option", { value: "WEP", text: "WEP" }), el("option", { value: "nopass", text: "Sin contraseña" })]);
        const hid = el("input", { type: "checkbox", style: "width:18px;height:18px;accent-color:var(--brand)" });
        box.appendChild(field("Nombre de la red (SSID)", ssid)); box.appendChild(field("Seguridad", sec));
        const fp = field("Contraseña", pass); box.appendChild(fp);
        box.appendChild(el("label", { style: "display:flex;gap:10px;align-items:center;font-weight:600;font-size:.93rem" }, [hid, "Red oculta"]));
        sec.addEventListener("change", () => { fp.hidden = sec.value === "nopass"; });
        return {
          read() {
            if (!ssid.value.trim()) return { ok: false, payload: "", name: "wifi" };
            const p = "WIFI:T:" + sec.value + ";S:" + esc(ssid.value.trim()) + ";" + (sec.value === "nopass" ? "" : "P:" + esc(pass.value) + ";") + "H:" + (hid.checked ? "true" : "false") + ";;";
            return { ok: true, payload: p, name: "wifi-" + slug(ssid.value) };
          }
        };
      }
    },
    vcard: {
      label: "Contacto",
      build(box) {
        const fn = input({ placeholder: "Nombre", autocomplete: "off" }), ln = input({ placeholder: "Apellido", autocomplete: "off" });
        const org = input({ placeholder: "Empresa" }), title = input({ placeholder: "Cargo" });
        const ph = phoneBlock("Teléfono");
        const mail = input({ type: "email", placeholder: "correo@empresa.com" }), web = input({ type: "url", placeholder: "https://tuweb.com" });
        box.appendChild(el("div", { class: "row" }, [field("Nombre", fn), field("Apellido", ln)]));
        box.appendChild(el("div", { class: "row" }, [field("Empresa", org), field("Cargo", title)]));
        box.appendChild(ph.node); box.appendChild(field("Correo", mail)); box.appendChild(field("Sitio web", web));
        return {
          read() {
            const p = ph.pf.read(); ph.pf.showError(p.error);
            if (!fn.value.trim() && !ln.value.trim()) return { ok: false, payload: "", name: "contacto" };
            const L = ["BEGIN:VCARD", "VERSION:3.0", "N:" + vesc(ln.value.trim()) + ";" + vesc(fn.value.trim()) + ";;;", "FN:" + vesc((fn.value + " " + ln.value).trim())];
            if (org.value.trim()) L.push("ORG:" + vesc(org.value.trim()));
            if (title.value.trim()) L.push("TITLE:" + vesc(title.value.trim()));
            if (p.ok) L.push("TEL;TYPE=CELL:+" + p.digits);
            if (mail.value.trim()) L.push("EMAIL:" + mail.value.trim());
            if (web.value.trim()) L.push("URL:" + web.value.trim());
            L.push("END:VCARD");
            return { ok: true, payload: L.join("\n"), name: "contacto-" + slug(fn.value + " " + ln.value) };
          }
        };
      }
    },
    phone: {
      label: "Llamada",
      build(box) {
        const ph = phoneBlock("Número al que llamar");
        box.appendChild(ph.node);
        return { read() { const r = ph.pf.read(); ph.pf.showError(r.error); return r.ok ? { ok: true, payload: "tel:+" + r.digits, name: "llamada" } : { ok: false, payload: "", name: "llamada" }; } };
      }
    },
    sms: {
      label: "SMS",
      build(box) {
        const ph = phoneBlock("Número de destino");
        const msg = textarea({ maxlength: "160", placeholder: "Mensaje de texto (opcional)" });
        box.appendChild(ph.node); box.appendChild(field("Mensaje (opcional)", msg));
        return { read() { const r = ph.pf.read(); ph.pf.showError(r.error); return r.ok ? { ok: true, payload: "SMSTO:+" + r.digits + ":" + msg.value, name: "sms" } : { ok: false, payload: "", name: "sms" }; } };
      }
    }
  };

  /* ---------- layout ---------- */
  const left = el("div");
  const p1 = el("div", { class: "panel" });
  const multi = cfg.types.length > 1;
  p1.appendChild(el("h2", { text: multi ? "¿Qué quieres compartir?" : "Datos de tu código QR" }));
  p1.appendChild(el("p", { class: "sub", text: multi ? "Elige el tipo de QR y completa los datos." : "Escribe el número y el mensaje que verá tu cliente al escanear." }));
  const tabs = el("div", { class: "tabs", role: "tablist", "aria-label": "Tipo de QR" });
  const forms = {};
  const apis = {};
  let active = cfg.types.includes(cfg.initial) ? cfg.initial : cfg.types[0];
  cfg.types.forEach((k) => {
    const box = el("div", { role: "tabpanel", hidden: k !== active });
    forms[k] = box; apis[k] = TYPES[k].build(box);
    if (multi) tabs.appendChild(el("button", { type: "button", role: "tab", "data-k": k, "aria-selected": k === active ? "true" : "false", text: TYPES[k].label, onclick: () => setActive(k) }));
  });
  if (multi) p1.appendChild(tabs);
  cfg.types.forEach((k) => p1.appendChild(forms[k]));
  left.appendChild(p1);

  // Personalización
  const p2 = el("div", { class: "panel" });
  const det = el("details", { class: "more", style: "border-top:0;padding-top:0;margin-top:0", open: true });
  det.appendChild(el("summary", { text: "Personalizar el diseño" }));
  const body = el("div");
  const fg = el("input", { type: "color", value: "#0d1b3a", "aria-label": "Color del código" });
  const bg = el("input", { type: "color", value: "#ffffff", "aria-label": "Color de fondo" });
  body.appendChild(el("div", { class: "swatch-row", style: "margin-bottom:18px" }, [
    el("label", { class: "swatch" }, [fg, "Color del código"]), el("label", { class: "swatch" }, [bg, "Color de fondo"])
  ]));
  function seg(label, key, opts, initial) {
    const wrap = el("div", { class: "field" }, [el("span", { class: "label", text: label })]);
    const s = el("div", { class: "seg", role: "group", "aria-label": label });
    const state = { v: initial };
    opts.forEach((o) => s.appendChild(el("button", { type: "button", "aria-pressed": o[0] === initial ? "true" : "false", text: o[1], onclick: () => {
      state.v = o[0]; Array.from(s.children).forEach((b, i) => b.setAttribute("aria-pressed", opts[i][0] === o[0] ? "true" : "false")); schedule();
    } })));
    wrap.appendChild(s); body.appendChild(wrap);
    return state;
  }
  const shape = seg("Forma de los puntos", "shape", [["square", "Cuadrados"], ["rounded", "Redondeados"], ["dots", "Puntos"]], "square");
  const eye = seg("Forma de las esquinas", "eye", [["square", "Cuadradas"], ["rounded", "Redondeadas"], ["circle", "Circulares"]], "square");
  const margin = el("input", { type: "range", min: "1", max: "8", step: "1", value: "4", "aria-label": "Margen" });
  body.appendChild(field("Margen blanco alrededor", margin, "Los lectores necesitan un borde libre. Menos de 2 módulos puede fallar al imprimir."));
  const ecc = el("select", { class: "select" }, [el("option", { value: "L", text: "L · Baja (QR más simple)" }), el("option", { value: "M", text: "M · Media (recomendada)", selected: true }), el("option", { value: "Q", text: "Q · Alta" }), el("option", { value: "H", text: "H · Máxima (resiste daños)" })]);
  body.appendChild(field("Corrección de errores", ecc));
  let logo = "";
  const logoFile = el("input", { type: "file", accept: "image/png,image/jpeg,image/svg+xml,image/webp", class: "sr-only", id: "qr-logo-file" });
  const logoBtn = el("label", { class: "btn small ghost filebtn", for: "qr-logo-file", text: "Subir logo" });
  const logoRm = el("button", { type: "button", class: "btn small ghost", text: "Quitar logo", hidden: true, onclick: () => { logo = ""; logoFile.value = ""; logoRm.hidden = true; schedule(); } });
  body.appendChild(el("div", { class: "field" }, [el("span", { class: "label", text: "Logo en el centro (opcional)" }), el("div", { class: "actions" }, [logoFile, logoBtn, logoRm]), el("div", { class: "hint", text: "Con logo usamos corrección máxima automáticamente. Prueba el escaneo antes de imprimir." })]));
  logoFile.addEventListener("change", () => {
    const f = logoFile.files && logoFile.files[0]; if (!f) return;
    if (f.size > 4 * 1024 * 1024) { toast("El logo pesa más de 4 MB"); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = 256, cv = document.createElement("canvas"); cv.width = s; cv.height = s;
        const ctx = cv.getContext("2d"); const k = Math.min(s / im.width, s / im.height);
        ctx.drawImage(im, (s - im.width * k) / 2, (s - im.height * k) / 2, im.width * k, im.height * k);
        logo = cv.toDataURL("image/png"); logoRm.hidden = false; schedule();
      };
      im.onerror = () => toast("No pudimos leer esa imagen");
      im.src = fr.result;
    };
    fr.readAsDataURL(f);
  });
  const sizeSel = el("select", { class: "select" }, [el("option", { value: "512", text: "512 px (web y redes)" }), el("option", { value: "1024", text: "1024 px (recomendado)", selected: true }), el("option", { value: "2048", text: "2048 px (impresión)" }), el("option", { value: "4096", text: "4096 px (gran formato)" })]);
  body.appendChild(field("Tamaño de descarga (PNG y JPG)", sizeSel, "Para impresión grande, descarga el SVG: no pierde calidad."));
  det.appendChild(body); p2.appendChild(det);
  left.appendChild(p2);

  // Cartel
  let posterPanel = null, posterHead, posterSub, posterBrand;
  if (cfg.poster) {
    posterPanel = el("div", { class: "panel" });
    posterPanel.appendChild(el("h2", { text: "Cartel listo para imprimir" }));
    posterPanel.appendChild(el("p", { class: "sub", text: "Descarga un cartel A5 con tu QR, listo para el mostrador, la vitrina o el empaque." }));
    posterHead = input({ value: "Escríbenos por WhatsApp", maxlength: "48" });
    posterSub = input({ value: "Escanea el código con la cámara de tu celular y chatea con nosotros.", maxlength: "90" });
    posterBrand = input({ placeholder: "Nombre de tu negocio", maxlength: "36" });
    posterPanel.appendChild(field("Título", posterHead)); posterPanel.appendChild(field("Texto de apoyo", posterSub)); posterPanel.appendChild(field("Tu negocio (opcional)", posterBrand));
    posterPanel.appendChild(el("button", { type: "button", class: "btn dark", id: "poster-dl", text: "Descargar cartel PNG" }));
    left.appendChild(posterPanel);
  }

  // Panel derecho
  const right = el("aside", { class: "sticky" });
  const pv = el("div", { class: "panel" });
  const stage = el("div", { class: "qr-stage" });
  const holder = el("div", { class: "qr-canvas", role: "img", "aria-label": "Vista previa del código QR" });
  stage.appendChild(holder); pv.appendChild(stage);
  const meta = el("div", { class: "qr-meta" });
  pv.appendChild(meta);
  const warn = el("div");
  pv.appendChild(warn);
  const dlRow = el("div", { class: "actions" });
  const bPng = el("button", { type: "button", class: "btn", text: "Descargar PNG" });
  const bJpg = el("button", { type: "button", class: "btn ghost", text: "JPG" });
  const bSvg = el("button", { type: "button", class: "btn ghost", text: "SVG" });
  dlRow.appendChild(bPng); dlRow.appendChild(bJpg); dlRow.appendChild(bSvg);
  pv.appendChild(dlRow);
  const extra = el("div", { class: "actions", style: "margin-top:10px" });
  pv.appendChild(extra);
  right.appendChild(pv);
  root.appendChild(el("div", { class: "tool" }, [left, right]));

  /* ---------- lógica ---------- */
  let last = { ok: false, svg: "", name: "qr", res: null };

  function setActive(k) {
    active = k;
    cfg.types.forEach((t) => { forms[t].hidden = t !== k; });
    $$("button", tabs).forEach((b) => b.setAttribute("aria-selected", b.dataset.k === k ? "true" : "false"));
    update();
  }

  function emptyStage(msg) {
    holder.style.background = "transparent"; holder.style.boxShadow = "none";
    holder.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3m4 0v4h-4m-3-4v4"/></svg><div>' + msg + "</div></div>";
  }

  function update() {
    const res = apis[active].read();
    warn.textContent = ""; meta.textContent = ""; extra.textContent = "";
    const set = (dis) => { bPng.disabled = bJpg.disabled = bSvg.disabled = dis; if (posterPanel) $("#poster-dl").disabled = dis; };
    if (!res.ok) { last = { ok: false, svg: "", name: res.name, res: res }; emptyStage("Completa los datos y aparecerá tu código QR aquí."); set(true); return; }

    const ecl = logo ? "H" : ecc.value;
    const qr = makeQR(res.payload, ecl);
    if (!qr) { last = { ok: false, svg: "", name: res.name, res: res }; emptyStage("Hay demasiado contenido para un QR. Acórtalo e inténtalo de nuevo."); set(true); return; }

    const svg = qrSvg(qr, { fg: fg.value, bg: bg.value, shape: shape.v, eye: eye.v, margin: +margin.value, logo: logo });
    holder.style.background = ""; holder.style.boxShadow = "";
    holder.innerHTML = svg;
    last = { ok: true, svg: svg, name: res.name, res: res };
    set(false);

    const d = qrDensity(qr);
    meta.appendChild(el("span", {}, ["Densidad: ", el("span", { class: "badge " + d.cls, text: d.label })]));
    meta.appendChild(el("span", { text: d.tip }));

    const c = contrast(fg.value, bg.value);
    if (c < 3) warn.appendChild(el("div", { class: "note bad", style: "margin:0 0 14px", text: "Contraste muy bajo (" + c.toFixed(1) + ":1). Elige un color de código mucho más oscuro que el fondo o muchos lectores no lo leerán." }));
    else if (bright(fg.value) > bright(bg.value)) warn.appendChild(el("div", { class: "note warn", style: "margin:0 0 14px", text: "Un código más claro que el fondo no lo leen todos los lectores. Si vas a imprimirlo, invierte los colores." }));
    else if (shape.v === "dots" && ecc.value === "L" && !logo) warn.appendChild(el("div", { class: "note warn", style: "margin:0 0 14px", text: "Con puntos redondos conviene usar corrección de errores M o superior." }));

    if (res.link) {
      extra.appendChild(el("button", { type: "button", class: "btn small ghost", text: "Copiar enlace", onclick: () => copyText(res.link, "Enlace copiado") }));
      extra.appendChild(el("a", { class: "btn small ghost", href: res.link, target: "_blank", rel: "noopener", text: "Probar enlace" }));
    }
  }
  const schedule = debounce(update, 90);

  [p1, p2].forEach((p) => { p.addEventListener("input", schedule); p.addEventListener("change", schedule); });
  if (posterPanel) { /* el cartel no cambia el QR */ }

  /* Descargas */
  async function raster(type) {
    if (!last.ok) return;
    const px = +sizeSel.value;
    try {
      const cv = await svgToCanvas(last.svg, px);
      const blob = await canvasBlob(cv, type === "jpg" ? "image/jpeg" : "image/png", 0.95);
      downloadBlob(blob, "qr-" + last.name + "." + type);
      toast("Descargando " + type.toUpperCase());
    } catch (e) { toast("No se pudo generar la imagen"); }
  }
  bPng.addEventListener("click", () => raster("png"));
  bJpg.addEventListener("click", () => raster("jpg"));
  bSvg.addEventListener("click", () => { if (last.ok) { downloadBlob(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + last.svg], { type: "image/svg+xml" }), "qr-" + last.name + ".svg"); toast("Descargando SVG"); } });

  /* Cartel */
  function wrapLines(ctx, text, maxW) {
    const words = text.split(/\s+/), lines = []; let cur = "";
    words.forEach((w) => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  async function poster() {
    if (!last.ok) return;
    try { await document.fonts.load("800 80px 'Bricolage Grotesque'"); await document.fonts.load("500 30px 'Instrument Sans'"); } catch (_) { /* usa la fuente de respaldo */ }
    const W = 1240, H = 1748, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#0d1b3a"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1d4dff"; ctx.beginPath(); ctx.arc(W - 90, 120, 330, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffb020"; rr(ctx, 90, 150, 110, 14, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textBaseline = "alphabetic";
    ctx.font = "800 108px 'Bricolage Grotesque', 'Trebuchet MS', sans-serif";
    const hl = wrapLines(ctx, posterHead.value.trim() || "Escríbenos por WhatsApp", W - 180);
    let y = 290; hl.slice(0, 3).forEach((l) => { ctx.fillText(l, 90, y); y += 118; });
    const side = 800, qx = (W - side) / 2, qy = Math.max(y + 30, 640);
    ctx.fillStyle = "#fff"; rr(ctx, qx - 50, qy - 50, side + 100, side + 100, 48); ctx.fill();
    const qcv = await svgToCanvas(last.svg, 1600);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(qcv, qx, qy, side, side);
    ctx.fillStyle = "#e5ebff"; ctx.font = "500 44px 'Instrument Sans', system-ui, sans-serif";
    let ty = qy + side + 130;
    wrapLines(ctx, posterSub.value.trim() || "Escanea el código con la cámara de tu celular.", W - 240).slice(0, 3).forEach((l) => { ctx.fillText(l, 90, ty); ty += 58; });
    if (posterBrand.value.trim()) { ctx.fillStyle = "#ffb020"; ctx.font = "800 52px 'Bricolage Grotesque', 'Trebuchet MS', sans-serif"; ctx.fillText(posterBrand.value.trim(), 90, H - 100); }
    const blob = await canvasBlob(cv, "image/png");
    downloadBlob(blob, "cartel-qr-" + last.name + ".png"); toast("Descargando cartel");
  }
  if (posterPanel) $("#poster-dl").addEventListener("click", poster);

  /* Prefill desde la URL */
  const q = new URLSearchParams(location.search);
  if (q.get("type") && cfg.types.includes(q.get("type"))) active = q.get("type");
  if (apis.whatsapp && apis.whatsapp.prefill) apis.whatsapp.prefill(q);
  setActive(active);
})();
