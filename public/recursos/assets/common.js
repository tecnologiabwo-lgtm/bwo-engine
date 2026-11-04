/* ------------------------------------------------------------------
   Utilidades compartidas: configuración, WhatsApp, QR y descargas.
------------------------------------------------------------------- */
(function () {
  "use strict";

  const CFG = Object.assign(
    { brand: "BigWay", whatsapp: "", contactUrl: "#contacto", ctaLabel: "Hablar con BigWay", ratesVerified: "" },
    window.BIGWAY_CONFIG || {}
  );

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    });
    (children || []).forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  }

  function debounce(fn, ms) {
    let t;
    return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); };
  }

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = el("div", { class: "toast", role: "status", "aria-live": "polite" }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  async function copyText(text, okMsg) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else throw new Error("fallback");
    } catch (e) {
      const ta = el("textarea", { style: "position:fixed;opacity:0;left:-999px" });
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (_) { /* nada */ }
      ta.remove();
    }
    toast(okMsg || "Copiado");
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function slug(s) {
    return (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "qr";
  }

  /* ---------- WhatsApp ---------- */
  const COUNTRIES = [
    ["Argentina", "54", "AR"], ["Bolivia", "591", "BO"], ["Brasil", "55", "BR"], ["Canadá", "1", "CA"], ["Chile", "56", "CL"],
    ["Colombia", "57", "CO"], ["Costa Rica", "506", "CR"], ["Cuba", "53", "CU"], ["Ecuador", "593", "EC"], ["El Salvador", "503", "SV"],
    ["España", "34", "ES"], ["Estados Unidos", "1", "US"], ["Francia", "33", "FR"], ["Guatemala", "502", "GT"], ["Honduras", "504", "HN"],
    ["Italia", "39", "IT"], ["México", "52", "MX"], ["Nicaragua", "505", "NI"], ["Panamá", "507", "PA"], ["Paraguay", "595", "PY"],
    ["Perú", "51", "PE"], ["Portugal", "351", "PT"], ["Puerto Rico", "1", "PR"], ["Reino Unido", "44", "GB"],
    ["República Dominicana", "1", "DO"], ["Uruguay", "598", "UY"], ["Venezuela", "58", "VE"]
  ];

  function guessCountryIso() {
    try {
      const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
      for (const l of langs) {
        const m = /-([A-Z]{2})$/i.exec(l || "");
        if (m && COUNTRIES.some((c) => c[2] === m[1].toUpperCase())) return m[1].toUpperCase();
      }
    } catch (_) { /* nada */ }
    return "MX";
  }

  /** Campo de teléfono: selector de país + número nacional. */
  function PhoneField(root, opts) {
    opts = opts || {};
    const id = "ph" + Math.random().toString(36).slice(2, 7);
    const sel = el("select", { class: "select", id: id + "-c", "aria-label": "País" });
    COUNTRIES.forEach((c) => sel.appendChild(el("option", { value: c[2], text: c[0] + " (+" + c[1] + ")" })));
    sel.value = guessCountryIso();
    const inp = el("input", { class: "input", id: id + "-n", type: "tel", inputmode: "tel", autocomplete: "tel-national", placeholder: opts.placeholder || "Número con WhatsApp", "aria-describedby": id + "-e" });
    const err = el("div", { class: "err", id: id + "-e", "aria-live": "polite" });
    const row = el("div", { class: "row phone-field" }, [sel, inp]);
    root.appendChild(row); root.appendChild(err);

    const dial = () => COUNTRIES.find((c) => c[2] === sel.value)[1];

    // Si pegan un número internacional completo (+58 412...), detecta el país
    inp.addEventListener("input", () => {
      const raw = inp.value.trim();
      if (/^(\+|00)/.test(raw)) {
        const digits = raw.replace(/\D/g, "").replace(/^00/, "");
        const hit = COUNTRIES.slice().sort((a, b) => b[1].length - a[1].length).find((c) => digits.startsWith(c[1]));
        if (hit) {
          const current = COUNTRIES.find((c) => c[2] === sel.value);
          if (!current || current[1] !== hit[1]) sel.value = hit[2];
          inp.value = digits.slice(hit[1].length);
        }
      }
    });

    function read() {
      const national = inp.value.replace(/\D/g, "").replace(/^0+/, "");
      const d = dial();
      const digits = d + national;
      let error = "";
      if (!national) error = "";
      else if (digits.length < 8 || digits.length > 15) error = "El número debe tener entre 8 y 15 dígitos con el código de país.";
      return { ok: !!national && !error, digits: national ? digits : "", dial: d, national: national, error: error, iso: sel.value };
    }
    function showError(msg) { err.textContent = msg || ""; inp.setAttribute("aria-invalid", msg ? "true" : "false"); }

    const onChange = (fn) => { sel.addEventListener("change", fn); inp.addEventListener("input", fn); };
    function set(digits) {
      if (!digits) return;
      const clean = String(digits).replace(/\D/g, "");
      const hit = COUNTRIES.slice().sort((a, b) => b[1].length - a[1].length).find((c) => clean.startsWith(c[1]));
      if (hit) { sel.value = hit[2]; inp.value = clean.slice(hit[1].length); } else { inp.value = clean; }
    }
    return { read: read, showError: showError, onChange: onChange, set: set, input: inp, select: sel };
  }

  function waLink(digits, text, style) {
    const t = text && text.trim() ? encodeURIComponent(text.trim()) : "";
    if (style === "api") return "https://api.whatsapp.com/send?phone=" + digits + (t ? "&text=" + t : "");
    return "https://wa.me/" + digits + (t ? "?text=" + t : "");
  }

  /* ---------- Contraste ---------- */
  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function luminance(hex) {
    const c = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* ---------- QR ---------- */
  function makeQR(text, ecl) {
    if (typeof qrcode !== "function") return null;
    try {
      const q = qrcode(0, ecl || "M");
      q.addData(text);
      q.make();
      return q;
    } catch (e) { return null; }
  }

  function rrect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    if (r <= 0) return "M" + x + " " + y + "h" + w + "v" + h + "h" + (-w) + "z";
    return "M" + (x + r) + " " + y + "h" + (w - 2 * r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r +
      "v" + (h - 2 * r) + "a" + r + " " + r + " 0 0 1 " + (-r) + " " + r +
      "h" + (-(w - 2 * r)) + "a" + r + " " + r + " 0 0 1 " + (-r) + " " + (-r) +
      "v" + (-(h - 2 * r)) + "a" + r + " " + r + " 0 0 1 " + r + " " + (-r) + "z";
  }
  function circle(cx, cy, r) {
    return "M" + (cx - r) + " " + cy + "a" + r + " " + r + " 0 1 0 " + (2 * r) + " 0a" + r + " " + r + " 0 1 0 " + (-2 * r) + " 0z";
  }

  /**
   * Genera el SVG del QR.
   * o: { fg, bg, shape: square|rounded|dots, eye: square|rounded|circle, margin, logo (dataURL), logoScale }
   */
  function qrSvg(qr, o) {
    o = Object.assign({ fg: "#000000", bg: "#ffffff", shape: "square", eye: "square", margin: 4, logo: "", logoScale: 0.22 }, o || {});
    const n = qr.getModuleCount();
    const m = o.margin;
    const size = n + 2 * m;
    const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    const logoSide = o.logo ? Math.ceil(n * o.logoScale) : 0;
    const lo = Math.floor((n - logoSide) / 2), hi = lo + logoSide;
    const inLogo = (r, c) => o.logo && r >= lo - 1 && r <= hi && c >= lo - 1 && c <= hi;

    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
        const x = c + m, y = r + m;
        if (o.shape === "dots") d += circle(x + 0.5, y + 0.5, 0.46);
        else if (o.shape === "rounded") d += rrect(x + 0.03, y + 0.03, 0.94, 0.94, 0.3);
        else d += "M" + x + " " + y + "h1v1h-1z";
      }
    }
    // Ojos (finder patterns)
    let eyes = "";
    const eyeR = o.eye === "circle" ? [3.5, 2.5, 1.5] : o.eye === "rounded" ? [2, 1.2, 0.8] : [0, 0, 0];
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach((p) => {
      const x = p[1] + m, y = p[0] + m;
      eyes += rrect(x, y, 7, 7, eyeR[0]) + rrect(x + 1, y + 1, 5, 5, eyeR[1]) + rrect(x + 2, y + 2, 3, 3, eyeR[2]);
    });

    let logoSvg = "";
    if (o.logo) {
      const ls = logoSide, lx = lo + m, ly = lo + m;
      logoSvg = '<rect x="' + (lx - 0.6) + '" y="' + (ly - 0.6) + '" width="' + (ls + 1.2) + '" height="' + (ls + 1.2) + '" rx="1.2" fill="' + o.bg + '"/>' +
        '<image href="' + o.logo + '" x="' + lx + '" y="' + ly + '" width="' + ls + '" height="' + ls + '" preserveAspectRatio="xMidYMid meet"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + " " + size + '" shape-rendering="geometricPrecision" role="img" aria-label="Código QR">' +
      '<rect width="' + size + '" height="' + size + '" fill="' + o.bg + '"/>' +
      '<path d="' + d + '" fill="' + o.fg + '"/>' +
      '<path d="' + eyes + '" fill="' + o.fg + '" fill-rule="evenodd"/>' + logoSvg + "</svg>";
  }

  /** Convierte un SVG en un canvas de px × px. */
  function svgToCanvas(svg, px) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = px; cv.height = px;
        const ctx = cv.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, px, px);
        resolve(cv);
      };
      img.onerror = () => reject(new Error("No se pudo renderizar el QR"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }
  function canvasBlob(cv, type, q) {
    return new Promise((res) => cv.toBlob(res, type, q));
  }

  function qrDensity(qr) {
    const n = qr.getModuleCount();
    if (n <= 33) return { label: "Baja", cls: "ok", tip: "Se escanea fácil incluso pequeño." };
    if (n <= 49) return { label: "Media", cls: "ok", tip: "Imprímelo de al menos 3 cm de lado." };
    if (n <= 73) return { label: "Alta", cls: "mid", tip: "Imprímelo de al menos 5 cm y acorta el texto si puedes." };
    return { label: "Muy alta", cls: "bad", tip: "Demasiado contenido: acorta el texto o usa un enlace corto." };
  }

  /* ---------- Teléfono de vista previa (HTML) ---------- */
  function phonePreview(name) {
    const wrap = el("div", { class: "phone", "aria-label": "Vista previa del chat" });
    const top = el("div", { class: "phone-top" }, [
      el("div", { class: "avatar", text: (name || "T").charAt(0).toUpperCase() }),
      el("div", {}, [el("b", { text: name || "Tu negocio" }), el("small", { text: "en línea" })])
    ]);
    const bubble = el("div", { class: "bubble empty" });
    const time = el("time", { text: "ahora" });
    const chat = el("div", { class: "chat" }, [el("div", { class: "day", text: "Hoy" }), bubble]);
    const compose = el("div", { class: "compose" }, [el("span"), el("i")]);
    wrap.appendChild(top); wrap.appendChild(chat); wrap.appendChild(compose);
    function setMessage(text) {
      bubble.textContent = "";
      if (text && text.trim()) { bubble.classList.remove("empty"); bubble.appendChild(document.createTextNode(text.trim())); bubble.appendChild(time); }
      else { bubble.classList.add("empty"); bubble.textContent = "El chat se abrirá con el cuadro de mensaje vacío."; }
    }
    function setName(n) { top.querySelector("b").textContent = n || "Tu negocio"; top.querySelector(".avatar").textContent = (n || "T").charAt(0).toUpperCase(); }
    setMessage("");
    return { node: wrap, setMessage: setMessage, setName: setName };
  }

  /** Enlace para contactar a BigWay (WhatsApp si está configurado). */
  function contactHref(message) {
    if (CFG.whatsapp) return waLink(CFG.whatsapp.replace(/\D/g, ""), message || "");
    return CFG.contactUrl;
  }

  // Enlaces de contacto (cabecera y bloque final) según la configuración
  function wireContact() {
    $$("[data-contact]").forEach((a) => {
      a.setAttribute("href", contactHref(""));
      if (CFG.whatsapp) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireContact); else wireContact();

  window.BW = {
    CFG: CFG, $: $, $$: $$, el: el, debounce: debounce, toast: toast, copyText: copyText, downloadBlob: downloadBlob, slug: slug,
    COUNTRIES: COUNTRIES, PhoneField: PhoneField, waLink: waLink, contrast: contrast,
    makeQR: makeQR, qrSvg: qrSvg, svgToCanvas: svgToCanvas, canvasBlob: canvasBlob, qrDensity: qrDensity,
    phonePreview: phonePreview, contactHref: contactHref
  };
})();
