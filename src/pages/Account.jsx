import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase, run } from "@/lib/supabase";
import { useToast } from "@/components/ui/toast";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui/primitives";

export default function Account() {
  const { profile, reload } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.full_name || "");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const saveName = async () => {
    setBusy(true);
    try { await run(supabase.from("profiles").update({ full_name: name.trim() }).eq("id", profile.id)); await reload(); toast("Nombre guardado"); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const savePass = async () => {
    if (pass.length < 8) { toast("La contraseña debe tener al menos 8 caracteres", "error"); return; }
    const { error } = await supabase.auth.updateUser({ password: pass });
    if (error) toast(error.message, "error"); else { setPass(""); toast("Contraseña actualizada"); }
  };
  return (
    <div className="max-w-xl">
      <PageHeader title="Mi cuenta" subtitle={`${profile?.email} · ${profile?.role === "admin" ? "Administrador (agencia)" : "Espectador (cliente)"}`} />
      <Card className="space-y-4">
        <Field label="Nombre visible"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Button onClick={saveName} loading={busy}>Guardar nombre</Button>
      </Card>
      <Card className="mt-4 space-y-4">
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres"><Input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
        <Button variant="ghost" onClick={savePass}>Cambiar contraseña</Button>
      </Card>
    </div>
  );
}
