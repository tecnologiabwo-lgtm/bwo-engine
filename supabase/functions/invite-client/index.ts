// Invitación de clientes por correo (Resend).
// Solo un admin activo puede llamarla. Crea la invitación, genera el enlace
// seguro de Supabase Auth y envía un correo con la marca de Big Way.
// Secretos necesarios en Supabase → Edge Functions → Secrets:
//   RESEND_API_KEY, INVITE_FROM ("Big Way Offices <hola@tudominio.com>"), SITE_URL
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function emailHtml({ name, clientName, link, existing, site }: { name: string; clientName: string; link: string; existing: boolean; site: string }) {
  const hi = name ? `Hola, ${esc(name)}` : "Hola";
  const intro = existing
    ? `Te dimos acceso a <b>${esc(clientName || "tu cuenta")}</b> en BWO Engine.`
    : `Big Way Offices te invitó a <b>BWO Engine</b>${clientName ? `, el espacio de <b>${esc(clientName)}</b>` : ""}. Ahí podrás revisar y aprobar tu feed, ver tus guiones, reportes y la evolución de tus campañas.`;
  const cta = existing ? "Entrar a BWO Engine" : "Crear mi contraseña";
  return `<!doctype html><html><body style="margin:0;background:#0D0E24;font-family:Arial,Helvetica,sans-serif;color:#E7E8F5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0E24;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#17183A;border-radius:20px;overflow:hidden">
<tr><td style="height:6px;background:linear-gradient(90deg,#F5A623,#E6197E,#6C3BF5,#22D3C5)"></td></tr>
<tr><td style="padding:28px 32px 8px"><img src="${site}/brand/biwi.webp" width="96" height="104" alt="Biwi" style="display:block"></td></tr>
<tr><td style="padding:0 32px"><h1 style="margin:12px 0 8px;font-size:22px;color:#fff">${hi} 👋</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#C9CBE6">${intro}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#C9CBE6">Soy Biwi, el asistente de Big Way. Te acompaño en tus primeros pasos.</p>
<a href="${link}" style="display:inline-block;background:#6C3BF5;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">${cta}</a>
<p style="margin:24px 0 0;font-size:12px;color:#8B8FC7">Este enlace es personal y caduca pronto. Si no esperabas este correo, ignóralo.</p></td></tr>
<tr><td style="padding:24px 32px;font-size:12px;color:#6F75A0">Big Way Offices · BWO Engine</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("INVITE_FROM") || "Big Way Offices <onboarding@resend.dev>";
  const site = (Deno.env.get("SITE_URL") || req.headers.get("origin") || "").replace(/\/$/, "");
  if (!resendKey) return json({ error: "Falta configurar RESEND_API_KEY en los secretos de Supabase." }, 500);
  if (!site) return json({ error: "Falta configurar SITE_URL." }, 500);

  // 1. ¿Quién llama? Debe ser admin activo (RBAC en el servidor, no en el navegador)
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: who } = await caller.auth.getUser();
  if (!who?.user) return json({ error: "Sesión no válida" }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role,status").eq("id", who.user.id).maybeSingle();
  if (me?.role !== "admin" || me?.status !== "active") return json({ error: "Solo la agencia puede invitar" }, 403);

  // 2. Datos
  let body: { email?: string; full_name?: string; client_id?: string | null; role?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const full_name = String(body.full_name || "").trim().slice(0, 120);
  const role = body.role === "admin" ? "admin" : "viewer";
  const client_id = body.client_id || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Correo no válido" }, 400);
  if (role === "viewer" && !client_id) return json({ error: "Elige el cliente al que tendrá acceso" }, 400);
  let clientName = "";
  if (client_id) {
    const { data: c } = await admin.from("clients").select("name").eq("id", client_id).maybeSingle();
    if (!c) return json({ error: "Cliente no encontrado" }, 404);
    clientName = c.name;
  }

  // 3. ¿Ya tiene cuenta? Entonces solo damos acceso y avisamos.
  const { data: existing } = await admin.from("profiles").select("id,status").eq("email", email).maybeSingle();
  const { data: inv, error: invErr } = await admin.from("invitations")
    .insert({ email, full_name, client_id, role, invited_by: who.user.id }).select("id").single();
  if (invErr) return json({ error: invErr.message }, 500);

  let link = "";
  if (existing) {
    if (client_id) await admin.from("client_members").upsert({ client_id, user_id: existing.id }, { onConflict: "client_id,user_id", ignoreDuplicates: true });
    await admin.from("invitations").update({ accepted_at: new Date().toISOString(), user_id: existing.id }).eq("id", inv.id);
    link = `${site}/login`;
  } else {
    const { data: gl, error: glErr } = await admin.auth.admin.generateLink({
      type: "invite", email, options: { redirectTo: `${site}/cuenta?bienvenida=1`, data: { full_name } },
    });
    if (glErr) { await admin.from("invitations").update({ send_error: glErr.message }).eq("id", inv.id); return json({ error: glErr.message }, 500); }
    link = gl.properties.action_link;
  }

  // 4. Correo con Resend
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [email],
      subject: existing ? `Ya tienes acceso a ${clientName || "BWO Engine"}` : `Big Way te invitó a BWO Engine${clientName ? ` · ${clientName}` : ""}`,
      html: emailHtml({ name: full_name, clientName, link, existing: !!existing, site }),
    }),
  });
  const rj = await r.json().catch(() => ({}));
  if (!r.ok) {
    await admin.from("invitations").update({ send_error: rj?.message || `Resend ${r.status}` }).eq("id", inv.id);
    return json({ error: `No se pudo enviar el correo: ${rj?.message || r.status}` }, 502);
  }
  await admin.from("invitations").update({ sent_at: new Date().toISOString(), send_error: null }).eq("id", inv.id);
  return json({ ok: true, existing: !!existing, invitation: inv.id });
});
