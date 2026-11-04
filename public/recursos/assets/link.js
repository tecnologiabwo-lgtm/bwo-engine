/* Generador de enlaces de WhatsApp (wa.me) */
(function () {
  "use strict";
  const { el, $, copyText, waLink, PhoneField, phonePreview, toast, CFG, contactHref } = BW;
  const root = $("#link-app");
  if (!root) return;

  const MAX = 300;
  const CHANNELS = ["Instagram", "Facebook", "Sitio web", "Anuncios", "Firma de email", "TikTok", "YouTube", "Tarjeta o cartel (QR)"];
  const QR_PAGE = "codigo-qr-whatsapp.html";

  /* ----- Panel izquierdo ----- */
  const left = el("div");
  const p1 = el("div", { class: "panel" });
  p1.appendChild(el("h2", { text: "Crea tu enlace" }));
  p1.appendChild(el("p", { class: "sub", text: "Con el número y un mensaje opcional, tus clientes abren el chat con un solo toque." }));

  const fPhone = el("div", { class: "field" });
  fPhone.appendChild(el("label", { text: "Número de WhatsApp", for: "lk-phone-placeholder" }));
  const phoneHost = el("div");
  fPhone.appendChild(phoneHost);
  const phone = PhoneField(phoneHost, { placeholder: "Ej. 412 1234567" });
  phone.input.id = "lk-phone-placeholder";
  fPhone.appendChild(el("div", { class: "hint", text: "Escríbelo sin el 0 inicial ni el +. Si pegas un número internacional completo, detectamos el país." }));
  p1.appendChild(fPhone);

  const fMsg = el("div", { class: "field" });
  fMsg.appendChild(el("label", { for: "lk-msg", text: "Mensaje inicial (opcional)" }));
  const msg = el("textarea", { class: "textarea", id: "lk-msg", maxlength: String(MAX), placeholder: "Hola, quiero información sobre sus servicios." });
  const cnt = el("div", { class: "count", text: "0 / " + MAX });
  fMsg.appendChild(msg); fMsg.appendChild(cnt);
  fMsg.appendChild(el("div", { class: "hint", text: "El cliente verá este texto ya escrito en el chat y solo tiene que enviarlo." }));
  p1.appendChild(fMsg);

  const fStyle = el("div", { class: "field" });
  fStyle.appendChild(el("span", { class: "label", text: "Formato del enlace" }));
  const seg = el("div", { class: "seg", role: "group", "aria-label": "Formato del enlace" });
  let style = "wame";
  const bWame = el("button", { type: "button", "aria-pressed": "true", text: "wa.me (corto)" });
  const bApi = el("button", { type: "button", "aria-pressed": "false", text: "api.whatsapp.com" });
  seg.appendChild(bWame); seg.appendChild(bApi);
  fStyle.appendChild(seg);
  p1.appendChild(fStyle);

  const fName = el("div", { class: "field", style: "margin-bottom:0" });
  fName.appendChild(el("label", { for: "lk-name", text: "Nombre de tu negocio (solo para la vista previa)" }));
  const nameIn = el("input", { class: "input", id: "lk-name", placeholder: "Tu negocio", maxlength: "40" });
  fName.appendChild(nameIn);
  p1.appendChild(fName);
  left.appendChild(p1);

  /* ----- Resultado ----- */
  const p2 = el("div", { class: "panel" });
  p2.appendChild(el("h2", { text: "Tu enlace" }));
  const out = el("div", { style: "margin-top:14px" });
  p2.appendChild(out);
  left.appendChild(p2);

  /* ----- Variantes por canal ----- */
  const p3 = el("div", { class: "panel" });
  p3.appendChild(el("h2", { text: "Un enlace por canal" }));
  p3.appendChild(el("p", { class: "sub", text: "Cada enlace agrega al mensaje de dónde viene el cliente. Tu CRM o chatbot puede leer esa frase y etiquetar el origen del contacto." }));
  const tagToggle = el("label", { style: "display:flex;gap:10px;align-items:center;margin-bottom:14px;font-weight:600;font-size:.93rem" }, [
    el("input", { type: "checkbox", id: "lk-tag", checked: true, style: "width:18px;height:18px;accent-color:var(--brand)" }), "Añadir el origen al mensaje"
  ]);
  p3.appendChild(tagToggle);
  const tableWrap = el("div", { class: "table-wrap" });
  p3.appendChild(tableWrap);
  left.appendChild(p3);

  /* ----- Snippets ----- */
  const p4 = el("div", { class: "panel" });
  p4.appendChild(el("h2", { text: "Código para tu web" }));
  p4.appendChild(el("p", { class: "sub", text: "Pega el código tal cual en tu sitio (WordPress, Webflow, Wix, HTML)." }));
  const tabs = el("div", { class: "tabs", role: "tablist" });
  const SN = [["link", "Enlace de texto"], ["button", "Botón"], ["float", "Botón flotante"]];
  let snKey = "link";
  SN.forEach((s) => tabs.appendChild(el("button", { type: "button", role: "tab", "data-k": s[0], "aria-selected": s[0] === snKey ? "true" : "false", text: s[1], onclick: () => { snKey = s[0]; renderSnippet(); $$tabs(); } })));
  function $$tabs() { Array.from(tabs.children).forEach((b) => b.setAttribute("aria-selected", b.dataset.k === snKey ? "true" : "false")); }
  p4.appendChild(tabs);
  const pre = el("pre", { class: "code", tabindex: "0" });
  p4.appendChild(pre);
  p4.appendChild(el("div", { class: "actions", style: "margin-top:12px" }, [
    el("button", { type: "button", class: "btn small ghost", text: "Copiar código", onclick: () => copyText(pre.textContent, "Código copiado") })
  ]));
  left.appendChild(p4);

  /* ----- Panel derecho ----- */
  const right = el("aside", { class: "sticky" });
  const pv = phonePreview("Tu negocio");
  const pvPanel = el("div", { class: "panel keep", style: "background:transparent;border:0;box-shadow:none;padding:0" }, [pv.node]);
  right.appendChild(pvPanel);
  right.appendChild(el("p", { class: "hint", style: "text-align:center;margin-top:14px", text: "Así verá tu cliente el chat al tocar el enlace." }));

  root.appendChild(el("div", { class: "tool" }, [left, right]));

  /* ----- Lógica ----- */
  let current = { link: "", digits: "", text: "" };

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  function update() {
    const ph = phone.read();
    const text = msg.value;
    cnt.textContent = text.length + " / " + MAX;
    phone.showError(ph.error);
    pv.setName(nameIn.value.trim());
    pv.setMessage(text);

    out.textContent = "";
    if (!ph.ok) {
      current = { link: "", digits: "", text: "" };
      out.appendChild(el("div", { class: "empty-state", html: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg><div>Escribe tu número para generar el enlace.</div>' }));
      renderChannels(); renderSnippet();
      return;
    }
    const link = waLink(ph.digits, text, style);
    current = { link: link, digits: ph.digits, text: text };

    const box = el("div", { class: "link-box" }, [
      el("code", { text: link }),
      el("button", { type: "button", class: "btn small", text: "Copiar", onclick: () => copyText(link, "Enlace copiado") })
    ]);
    out.appendChild(box);
    const acts = el("div", { class: "actions", style: "margin-top:14px" }, [
      el("a", { class: "btn small ghost", href: link, target: "_blank", rel: "noopener", text: "Probar el enlace" }),
      el("a", { class: "btn small ghost", href: QR_PAGE + "?phone=" + ph.digits + (text.trim() ? "&text=" + encodeURIComponent(text.trim()) : ""), text: "Convertir en código QR" })
    ]);
    out.appendChild(acts);
    if (ph.iso === "AR") out.appendChild(el("div", { class: "note", text: "En Argentina, los celulares suelen llevar un 9 después del 54 (54 9 11 …). Si el enlace no abre el chat, prueba agregándolo." }));
    renderChannels(); renderSnippet();
  }

  function channelText(base, ch) {
    const tag = $("#lk-tag").checked;
    const t = base.trim();
    if (!tag) return t;
    return t ? t + "\n\n(Vengo de " + ch + ")" : "Hola, vengo de " + ch;
  }

  function renderChannels() {
    tableWrap.textContent = "";
    if (!current.digits) { tableWrap.appendChild(el("div", { class: "empty-state", text: "Se generarán cuando escribas tu número." })); return; }
    const table = el("table", { class: "links" });
    table.appendChild(el("thead", {}, [el("tr", {}, [el("th", { text: "Canal" }), el("th", { text: "Mensaje" }), el("th", { text: "" })])]));
    const tb = el("tbody");
    CHANNELS.forEach((ch) => {
      const t = channelText(current.text, ch);
      const link = waLink(current.digits, t, style);
      tb.appendChild(el("tr", {}, [
        el("td", { text: ch, style: "font-weight:600;white-space:nowrap" }),
        el("td", { class: "msg", text: t.replace(/\n+/g, " ") }),
        el("td", {}, [el("button", { type: "button", class: "btn small ghost", text: "Copiar", onclick: () => copyText(link, "Enlace de " + ch + " copiado") })])
      ]));
    });
    table.appendChild(tb); tableWrap.appendChild(table);
  }

  function renderSnippet() {
    const href = current.link || "https://wa.me/NUMERO";
    const h = esc(href);
    let code = "";
    if (snKey === "link") {
      code = '<a href="' + h + '" target="_blank" rel="noopener">Escríbenos por WhatsApp</a>';
    } else if (snKey === "button") {
      code = '<a href="' + h + '" target="_blank" rel="noopener"\n   style="display:inline-block;padding:14px 26px;border-radius:12px;background:#128c7e;color:#fff;font:700 16px/1 system-ui,sans-serif;text-decoration:none">\n  Escríbenos por WhatsApp\n</a>';
    } else {
      code = '<a class="bw-wa" href="' + h + '" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">\n  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg>\n  <span>Escríbenos</span>\n</a>\n<style>\n.bw-wa{position:fixed;right:18px;bottom:18px;z-index:9999;display:flex;align-items:center;gap:10px;\n  padding:14px 20px;border-radius:999px;background:#128c7e;color:#fff;font:700 15px/1 system-ui,sans-serif;\n  text-decoration:none;box-shadow:0 12px 28px -10px rgba(13,27,58,.6)}\n.bw-wa:hover{background:#0e6f64}\n@media(max-width:560px){.bw-wa span{display:none}.bw-wa{padding:15px}}\n</style>';
    }
    pre.textContent = code;
  }

  bWame.addEventListener("click", () => { style = "wame"; bWame.setAttribute("aria-pressed", "true"); bApi.setAttribute("aria-pressed", "false"); update(); });
  bApi.addEventListener("click", () => { style = "api"; bApi.setAttribute("aria-pressed", "true"); bWame.setAttribute("aria-pressed", "false"); update(); });
  phone.onChange(update);
  msg.addEventListener("input", update);
  nameIn.addEventListener("input", update);
  $("#lk-tag").addEventListener("change", renderChannels);
  phone.input.addEventListener("blur", () => { const r = phone.read(); if (phone.input.value && !r.ok && !r.error) phone.showError("Escribe el número completo."); });

  update();
})();
