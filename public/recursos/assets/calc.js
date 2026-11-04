/* Calculadora de precios de WhatsApp Business (API de Meta) */
(function () {
  "use strict";
  const { el, $, $$, debounce, toast, copyText, downloadBlob, contactHref, CFG } = BW;
  const R = WA_RATES;
  const root = $("#calc-app");
  if (!root) return;

  const STOPS = [0, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
  const CATS = [
    { id: "marketing", name: "Plantillas de marketing", cls: "c-marketing", color: "#1d4dff",
      desc: "Promociones, lanzamientos, ofertas y recordatorios de carrito abandonado. Siempre se cobran.", rate: "marketing" },
    { id: "utility", name: "Plantillas de utilidad", cls: "c-utility", color: "#ffb020",
      desc: "Confirmaciones de pedido o cita, avisos de envío, recordatorios de pago. Sin fines promocionales.", rate: "utility" },
    { id: "auth", name: "Plantillas de autenticación", cls: "c-auth", color: "#0b8a5f",
      desc: "Códigos de un solo uso para verificar identidad. Mismo precio que utilidad en casi todos los países.", rate: "utility" },
    { id: "service", name: "Mensajes de servicio", cls: "c-service", color: "#7a4dff",
      desc: "Respuestas libres dentro de las 24 horas posteriores al último mensaje del cliente.", rate: "utility" }
  ];
  const PRESETS = {
    "Tienda online": { marketing: 3000, utility: 2500, auth: 0, service: 4000 },
    "Atención al cliente": { marketing: 0, utility: 500, auth: 0, service: 8000 },
    "Solo campañas": { marketing: 10000, utility: 0, auth: 0, service: 500 },
    "Citas y recordatorios": { marketing: 500, utility: 3000, auth: 0, service: 1500 }
  };

  const state = { country: "Colombia", marketing: 2000, utility: 1500, auth: 0, service: 3000, numbers: 1, provFee: 0, provMonthly: 0 };

  /* ---------- formato ---------- */
  const nf = (n, d) => n.toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d });
  const usd = (n, d) => "$" + nf(n, d == null ? 2 : d);
  const int = (n) => n.toLocaleString("es");
  const entry = (label) => R.entries.find((e) => e.label === label) || R.entries[0];

  /* ---------- UI: panel izquierdo ---------- */
  const left = el("div", { class: "panel" });
  left.appendChild(el("h2", { text: "Tus mensajes del mes" }));
  left.appendChild(el("p", { class: "sub", text: "Elige el país donde están la mayoría de tus clientes y cuántos mensajes de cada tipo esperas enviar." }));

  // País con filtro
  const fCountry = el("div", { class: "field" });
  fCountry.appendChild(el("label", { for: "c-filter", text: "País de tus clientes" }));
  const filter = el("input", { class: "input", id: "c-filter", type: "search", placeholder: "Escribe para filtrar (ej. Perú)", autocomplete: "off", style: "margin-bottom:8px" });
  const select = el("select", { class: "select", id: "c-select", "aria-label": "País" });
  fCountry.appendChild(filter); fCountry.appendChild(select);
  const marketNote = el("div", { class: "hint", id: "c-market" });
  fCountry.appendChild(marketNote);
  left.appendChild(fCountry);

  function fillCountries(q) {
    select.textContent = "";
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const nq = norm(q || "");
    const match = (e) => !nq || norm(e.label).includes(nq);
    if (!nq) {
      const g = el("optgroup", { label: "Frecuentes" });
      R.featured.forEach((name) => { const e = entry(name); g.appendChild(el("option", { value: e.label, text: e.label })); });
      select.appendChild(g);
    }
    const all = el("optgroup", { label: nq ? "Resultados" : "Todos los países" });
    R.entries.filter(match).forEach((e) => all.appendChild(el("option", { value: e.label, text: e.label })));
    select.appendChild(all);
    if (!all.children.length) select.appendChild(el("option", { value: "", text: "Sin resultados" }));
    // conserva selección
    const has = Array.from(select.options).some((o) => o.value === state.country);
    if (has) select.value = state.country; else if (select.options[0] && select.options[0].value) { select.value = select.options[0].value; }
    if (select.value && select.value !== state.country) { state.country = select.value; render(); }
  }

  // Presets
  const fPre = el("div", { class: "field" });
  fPre.appendChild(el("span", { class: "label", text: "Empieza con un ejemplo" }));
  const pre = el("div", { class: "seg" });
  Object.keys(PRESETS).forEach((name) => {
    pre.appendChild(el("button", { type: "button", text: name, onclick: () => { Object.assign(state, PRESETS[name]); syncInputs(); render(); } }));
  });
  fPre.appendChild(pre);
  left.appendChild(fPre);

  // Filas de cantidad
  const rows = {};
  const qtyWrap = el("div");
  CATS.forEach((c) => {
    const num = el("input", { class: "input", id: "q-" + c.id, type: "number", min: "0", step: "1", inputmode: "numeric" });
    const rng = el("input", { type: "range", min: "0", max: String(STOPS.length - 1), step: "1", "aria-label": "Ajustar " + c.name });
    const rate = el("span", { class: "qty-rate" });
    const head = el("div", { class: "qty-head" }, [
      el("label", { class: "qty-name", for: "q-" + c.id }, [el("span", { class: "dot " + c.cls }), c.name]), rate
    ]);
    const ctl = el("div", { class: "qty-ctl" }, [num, rng]);
    const block = el("div", { class: "qty" }, [head, el("div", { class: "qty-desc", text: c.desc }), ctl]);
    if (c.id === "service") {
      const nrow = el("div", { class: "row", style: "margin-top:12px;align-items:center" }, [
        el("label", { for: "q-numbers", style: "font-size:.9rem;font-weight:600;flex:1", text: "Números de WhatsApp Business" }),
        el("input", { class: "input", id: "q-numbers", type: "number", min: "1", step: "1", style: "width:92px", inputmode: "numeric" })
      ]);
      block.appendChild(nrow);
      block.appendChild(el("div", { class: "hint", text: "Cada número incluye " + int(R.freeServicePerNumber) + " mensajes de servicio gratis al mes. Después se cobran al precio de utilidad del país." }));
    }
    qtyWrap.appendChild(block);
    rows[c.id] = { num: num, rng: rng, rate: rate };
    num.addEventListener("input", () => { state[c.id] = Math.max(0, Math.floor(+num.value || 0)); rng.value = nearestStop(state[c.id]); render(); });
    rng.addEventListener("input", () => { state[c.id] = STOPS[+rng.value]; num.value = state[c.id]; render(); });
  });
  left.appendChild(qtyWrap);
  const numbersInput = qtyWrap.querySelector("#q-numbers");
  numbersInput.addEventListener("input", () => { state.numbers = Math.max(1, Math.floor(+numbersInput.value || 1)); render(); });

  // Proveedor
  const more = el("details", { class: "more" });
  more.appendChild(el("summary", { text: "Costos de tu proveedor o plataforma (opcional)" }));
  const mBody = el("div");
  mBody.appendChild(el("p", { class: "hint", style: "margin-top:0", text: "Meta cobra las tarifas de arriba. Tu CRM o proveedor oficial de la API puede sumar una suscripción mensual o un recargo por mensaje. Pídele su tarifa por escrito y compárala aquí." }));
  const fFee = el("div", { class: "field" }, [
    el("label", { for: "p-fee", text: "Recargo por mensaje cobrado (USD)" }),
    el("input", { class: "input", id: "p-fee", type: "number", min: "0", step: "0.001", placeholder: "0.000", inputmode: "decimal" })
  ]);
  const fMon = el("div", { class: "field" }, [
    el("label", { for: "p-mon", text: "Suscripción mensual de la plataforma (USD)" }),
    el("input", { class: "input", id: "p-mon", type: "number", min: "0", step: "1", placeholder: "0", inputmode: "decimal" })
  ]);
  mBody.appendChild(fFee); mBody.appendChild(fMon); more.appendChild(mBody);
  left.appendChild(more);
  $("#p-fee", more).addEventListener("input", (e) => { state.provFee = Math.max(0, +e.target.value || 0); render(); });
  $("#p-mon", more).addEventListener("input", (e) => { state.provMonthly = Math.max(0, +e.target.value || 0); render(); });

  left.appendChild(el("div", { class: "note info", html: "Las tarifas son las de lista de Meta, vigentes desde el <b>" + R.effectiveFrom + "</b> y verificadas el " + (CFG.ratesVerified || "—") + ". En utilidad y autenticación, Meta aplica descuentos por volumen que esta calculadora no descuenta, así que tu costo real puede ser menor." }));

  /* ---------- UI: recibo ---------- */
  const right = el("aside", { class: "sticky", "aria-live": "polite" });
  const receipt = el("div", { class: "receipt" });
  right.appendChild(receipt);
  const extra = el("div");
  right.appendChild(extra);

  const grid = el("div", { class: "tool" }, [left, right]);
  root.appendChild(grid);

  /* ---------- Cálculo ---------- */
  function compute(s) {
    const e = entry(s.country);
    const free = s.numbers * R.freeServicePerNumber;
    const billedService = Math.max(0, s.service - free);
    const lines = [
      { id: "marketing", qty: s.marketing, billed: s.marketing, rate: e.marketing },
      { id: "utility", qty: s.utility, billed: s.utility, rate: e.utility },
      { id: "auth", qty: s.auth, billed: s.auth, rate: e.utility },
      { id: "service", qty: s.service, billed: billedService, rate: e.utility, free: Math.min(s.service, free) }
    ];
    lines.forEach((l) => { l.amount = l.billed * l.rate; });
    const meta = lines.reduce((a, l) => a + l.amount, 0);
    const billedCount = lines.reduce((a, l) => a + l.billed, 0);
    const prov = billedCount * s.provFee + s.provMonthly;
    const total = meta + prov;
    const totalMsgs = s.marketing + s.utility + s.auth + s.service;
    return { e: e, lines: lines, meta: meta, prov: prov, total: total, billedCount: billedCount, totalMsgs: totalMsgs };
  }

  function summaryText(r) {
    const out = ["Estimado de costos de WhatsApp Business · " + r.e.label, ""];
    r.lines.forEach((l) => {
      const c = CATS.find((x) => x.id === l.id);
      out.push(c.name + ": " + int(l.qty) + " msgs" + (l.id === "service" && l.free ? " (" + int(l.free) + " gratis)" : "") + " → " + usd(l.amount));
    });
    out.push("Tarifas de Meta: " + usd(r.meta));
    if (r.prov) out.push("Proveedor: " + usd(r.prov));
    out.push("Total mensual: " + usd(r.total) + " · Anual: " + usd(r.total * 12));
    out.push("Tarifas de lista vigentes desde " + R.effectiveFrom + ".");
    return out.join("\n");
  }

  function shareUrl() {
    const u = new URL(location.href.split("#")[0].split("?")[0]);
    u.searchParams.set("p", state.country);
    u.searchParams.set("m", state.marketing); u.searchParams.set("u", state.utility);
    u.searchParams.set("a", state.auth); u.searchParams.set("s", state.service); u.searchParams.set("n", state.numbers);
    if (state.provFee) u.searchParams.set("pf", state.provFee);
    if (state.provMonthly) u.searchParams.set("pm", state.provMonthly);
    return u.toString();
  }

  function csv(r) {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const rows = [["Concepto", "Mensajes", "Mensajes cobrados", "Tarifa USD", "Subtotal USD"]];
    r.lines.forEach((l) => rows.push([CATS.find((x) => x.id === l.id).name, l.qty, l.billed, l.rate, l.amount.toFixed(4)]));
    rows.push(["Tarifas de Meta", "", "", "", r.meta.toFixed(4)]);
    rows.push(["Proveedor / plataforma", "", "", "", r.prov.toFixed(4)]);
    rows.push(["Total mensual", "", "", "", r.total.toFixed(4)]);
    rows.push(["Total anual", "", "", "", (r.total * 12).toFixed(4)]);
    rows.push(["País", r.e.label, "", "", ""]);
    rows.push(["Tarifas vigentes desde", R.effectiveFrom, "", "", ""]);
    return "﻿" + rows.map((x) => x.map(q).join(",")).join("\r\n");
  }

  /* ---------- Render ---------- */
  function render() {
    const r = compute(state);
    const e = r.e;
    marketNote.textContent = e.market === e.label ? "Tarifa propia de " + e.label + "." : "Se aplica la tarifa regional: " + e.market + ".";

    CATS.forEach((c) => { rows[c.id].rate.textContent = usd(e[c.rate], 4) + " por mensaje"; });

    const share = (v) => (r.total > 0 ? (v / r.total) * 100 : 0);
    const segs = r.lines.map((l) => ({ w: share(l.amount), color: CATS.find((x) => x.id === l.id).color }));
    segs.push({ w: share(r.prov), color: "#98a6c9" });

    let html = '<h2>Costo mensual estimado</h2>' +
      '<div class="total">' + usd(r.total) + '<small>USD / mes</small></div>' +
      '<div class="sub2">' + usd(r.total * 12) + ' al año' + (r.billedCount ? ' · ' + usd(r.meta / Math.max(r.billedCount, 1), 4) + ' por mensaje cobrado (Meta)' : '') + '</div>' +
      '<div class="stack" aria-hidden="true">' + segs.map((s) => '<i style="width:' + s.w.toFixed(2) + '%;background:' + s.color + '"></i>').join("") + '</div>' +
      '<ul class="lines">';
    r.lines.forEach((l) => {
      const c = CATS.find((x) => x.id === l.id);
      let calc = int(l.billed) + " × " + usd(l.rate, 4);
      if (l.id === "service") calc = l.free ? int(l.free) + " gratis · " + int(l.billed) + " × " + usd(l.rate, 4) : calc;
      html += '<li><span class="what"><span class="dot ' + c.cls + '"></span>' + c.name + '</span><span class="amt">' + usd(l.amount) + '</span><span class="calc">' + calc + '</span></li>';
    });
    html += '<li class="sum"><span>Tarifas de Meta</span><span class="amt">' + usd(r.meta) + '</span></li>';
    if (r.prov) html += '<li><span class="what"><span class="dot" style="background:#98a6c9"></span>Proveedor / plataforma</span><span class="amt">' + usd(r.prov) + '</span></li>';
    html += '</ul>';

    // Consejo contextual
    let tip = "";
    if (e.label === "Estados Unidos" && state.marketing > 0) {
      tip = "<b>Ojo:</b> WhatsApp no entrega plantillas de marketing a números de Estados Unidos, así que ese gasto no se materializaría. Canadá comparte la misma tarifa.";
    } else if (state.service > 0 && state.service <= R.freeServicePerNumber * state.numbers) {
      tip = "<b>Buena noticia:</b> tus mensajes de servicio caben dentro del cupo gratuito de " + int(R.freeServicePerNumber * state.numbers) + " al mes.";
    } else if (e.utility > 0) {
      const x = e.marketing / e.utility;
      tip = "<b>Dato útil:</b> en " + e.label + ", una plantilla de marketing cuesta " + nf(x, x >= 10 ? 0 : 1) + " veces más que una de utilidad. Clasificar bien tus plantillas es la forma más rápida de bajar la factura.";
    }
    if (tip) html += '<div class="tip">' + tip + '</div>';

    html += '<div class="receipt-actions">' +
      '<button type="button" class="btn small" data-a="copy">Copiar resumen</button>' +
      '<button type="button" class="btn small" data-a="link">Copiar enlace</button>' +
      '<button type="button" class="btn small" data-a="csv">Descargar CSV</button>' +
      '<button type="button" class="btn small" data-a="print">Imprimir</button></div>';
    receipt.innerHTML = html;

    // acciones
    receipt.querySelector('[data-a="copy"]').onclick = () => copyText(summaryText(r), "Resumen copiado");
    receipt.querySelector('[data-a="link"]').onclick = () => copyText(shareUrl(), "Enlace con tu estimación copiado");
    receipt.querySelector('[data-a="csv"]').onclick = () => downloadBlob(new Blob([csv(r)], { type: "text/csv;charset=utf-8" }), "estimado-whatsapp-" + e.label.toLowerCase().replace(/[^a-z]+/g, "-") + ".csv");
    receipt.querySelector('[data-a="print"]').onclick = () => window.print();

    // CTA
    extra.innerHTML = "";
    const cta = el("div", { class: "panel", style: "margin-top:16px;padding:20px" }, [
      el("b", { text: "¿Quieres bajar este costo?", style: "font-family:var(--font-display);font-size:1.1rem;display:block;margin-bottom:4px" }),
      el("p", { style: "color:var(--ink-2);font-size:.92rem;margin:0 0 14px", text: "Te ayudamos a clasificar tus plantillas, ordenar tus campañas y conectar WhatsApp con tu CRM." }),
      el("a", { class: "btn dark small", href: contactHref("Hola, calculé mi costo de WhatsApp Business: " + usd(r.total) + " al mes en " + e.label + ". Quiero asesoría."), text: CFG.ctaLabel, target: CFG.whatsapp ? "_blank" : null, rel: CFG.whatsapp ? "noopener" : null })
    ]);
    extra.appendChild(cta);
  }

  function nearestStop(v) {
    let best = 0, bd = Infinity;
    STOPS.forEach((s, i) => { const d = Math.abs(s - v); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function syncInputs() {
    CATS.forEach((c) => { rows[c.id].num.value = state[c.id]; rows[c.id].rng.value = nearestStop(state[c.id]); });
    numbersInput.value = state.numbers;
    select.value = state.country;
  }

  filter.addEventListener("input", debounce(() => fillCountries(filter.value), 120));
  select.addEventListener("change", () => { state.country = select.value; render(); });

  // Estado inicial desde URL
  (function init() {
    const p = new URLSearchParams(location.search);
    const num = (k, d) => (p.has(k) && isFinite(+p.get(k)) ? Math.max(0, Math.floor(+p.get(k))) : d);
    if (p.has("p") && R.entries.some((e) => e.label === p.get("p"))) state.country = p.get("p");
    state.marketing = num("m", state.marketing); state.utility = num("u", state.utility);
    state.auth = num("a", state.auth); state.service = num("s", state.service); state.numbers = Math.max(1, num("n", 1));
    if (p.has("pf")) { state.provFee = Math.max(0, +p.get("pf") || 0); $("#p-fee").value = state.provFee; more.open = true; }
    if (p.has("pm")) { state.provMonthly = Math.max(0, +p.get("pm") || 0); $("#p-mon").value = state.provMonthly; more.open = true; }
    fillCountries("");
    syncInputs();
    render();
  })();
})();
