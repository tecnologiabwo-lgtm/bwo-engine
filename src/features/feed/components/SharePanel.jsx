import { useEffect, useState, useCallback } from "react";
import { Copy, Link2, RotateCcw, Ban, Plus } from "lucide-react";
import { Card, Button, Input, Select, Badge, Field, ErrorBox } from "@/shared/ui/primitives";
import { ListSkeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast";
import * as api from "../api.js";

const when = (s) => (s ? new Date(s).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "");
const stateOf = (l) => (l.revoked_at ? ["Revocado", "red"] : l.expires_at && new Date(l.expires_at) < new Date() ? ["Caducado", "amber"] : ["Activo", "turquoise"]);
const DAYS = [["7", "7 días"], ["30", "30 días"], ["90", "90 días"], ["", "Sin caducidad"]];

export default function SharePanel({ client, onChanged }) {
  const [links, setLinks] = useState(null); const [err, setErr] = useState("");
  const [label, setLabel] = useState(""); const [days, setDays] = useState("30"); const [busy, setBusy] = useState(false);
  const toast = useToast();
  const load = useCallback(() => api.listLinks(client.id).then(setLinks).catch((e) => setErr(e.message)), [client.id]);
  useEffect(() => { load(); }, [load]);
  const copy = (t) => navigator.clipboard.writeText(api.linkUrl(t)).then(() => toast("Enlace copiado"));
  const act = async (fn, msg) => { setBusy(true); try { await fn(); toast(msg); await load(); onChanged?.(); } catch (e) { toast(e.message, "error"); } finally { setBusy(false); } };
  const expired = client.share_expires_at && new Date(client.share_expires_at) < new Date();

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-1 flex items-center gap-2 font-bold text-white"><Link2 className="size-4" />Enlace principal</div>
        <p className="mb-3 text-xs text-slate-400">Es el enlace histórico del cliente (el que ya tienen guardado). Rotarlo invalida el anterior al instante.</p>
        {client.share_token
          ? <div className="flex flex-wrap items-center gap-2"><code className="truncate rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">{api.linkUrl(client.share_token)}</code>
              <Badge color={expired ? "amber" : "turquoise"}>{expired ? "Caducado" : client.share_expires_at ? `Caduca ${when(client.share_expires_at)}` : "Sin caducidad"}</Badge>
              <Button size="sm" variant="ghost" onClick={() => copy(client.share_token)}><Copy className="size-4" />Copiar</Button></div>
          : <p className="text-sm text-slate-400">Sin enlace principal.</p>}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Nueva caducidad"><Select value={days} onChange={(e) => setDays(e.target.value)}>{DAYS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Select></Field>
          <Button variant="amber" loading={busy} onClick={() => confirm("El enlace actual dejará de funcionar. ¿Rotar?") && act(() => api.rotateMainLink(client.id, Number(days) || null), "Enlace rotado")}><RotateCcw className="size-4" />Rotar enlace</Button>
        </div>
      </Card>
      <Card>
        <div className="mb-3 font-bold text-white">Enlaces adicionales</div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Para quién" className="min-w-[200px] flex-1"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Gerente de marketing" /></Field>
          <Field label="Caducidad"><Select value={days} onChange={(e) => setDays(e.target.value)}>{DAYS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Select></Field>
          <Button loading={busy} disabled={!label.trim()} onClick={() => act(async () => { const t = await api.createLink(client.id, label.trim(), Number(days) || null); setLabel(""); await navigator.clipboard?.writeText(api.linkUrl(t)).catch(() => {}); }, "Enlace creado y copiado")}><Plus className="size-4" />Crear</Button>
        </div>
        <ErrorBox error={err} />
        <div className="mt-4 divide-y divide-white/5">
          {!links ? <ListSkeleton rows={3} /> : !links.length ? <p className="text-sm text-slate-500">Aún no hay enlaces adicionales.</p> : links.map((l) => {
            const [t, c] = stateOf(l);
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1"><div className="font-semibold text-slate-200">{l.label || "Sin nombre"}</div>
                  <div className="text-[11px] text-slate-500">Creado {when(l.created_at)}{l.expires_at && ` · caduca ${when(l.expires_at)}`} · {l.uses || 0} usos{l.last_used_at && ` · último ${when(l.last_used_at)}`}</div></div>
                <Badge color={c}>{t}</Badge>
                {t === "Activo" && <><Button size="sm" variant="ghost" onClick={() => copy(l.token)}><Copy className="size-4" /></Button>
                  <Button size="sm" variant="danger" onClick={() => act(() => api.revokeLink(l.id), "Enlace revocado")}><Ban className="size-4" />Revocar</Button></>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
