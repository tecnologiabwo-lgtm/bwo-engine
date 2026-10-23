import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function Card({ className, children, ...p }) {
  return <div className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl", className)} {...p}>{children}</div>;
}

export function Button({ variant = "primary", size = "md", className, loading, children, ...p }) {
  const v = {
    primary: "bg-bwo-violet text-white hover:brightness-110 shadow-[0_6px_20px_rgba(108,59,245,.35)]",
    ghost: "bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10",
    ok: "bg-bwo-turquoise text-bwo-inkDeep hover:brightness-110",
    danger: "bg-bwo-cerise text-white hover:brightness-110",
    amber: "bg-bwo-amber text-bwo-inkDeep hover:brightness-110",
  }[variant];
  const s = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" }[size];
  return (
    <button
      className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none", v, s, className)}
      disabled={loading || p.disabled}
      {...p}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-bwo-violet focus:bg-white/10";

export function Input({ className, ...p }) { return <input className={cn(inputCls, className)} {...p} />; }
export function Textarea({ className, ...p }) { return <textarea className={cn(inputCls, "min-h-[84px] resize-y", className)} {...p} />; }
export function Select({ className, children, ...p }) {
  return <select className={cn(inputCls, "appearance-none [&>option]:text-bwo-ink", className)} {...p}>{children}</select>;
}

export function Badge({ color = "violet", className, children }) {
  const c = {
    violet: "bg-bwo-violet/20 text-bwo-violetLt border-bwo-violet/30",
    cerise: "bg-bwo-cerise/20 text-bwo-ceriseLt border-bwo-cerise/30",
    turquoise: "bg-bwo-turquoise/15 text-bwo-turquoiseLt border-bwo-turquoise/30",
    amber: "bg-bwo-amber/15 text-amber-300 border-bwo-amber/30",
    slate: "bg-white/5 text-slate-300 border-white/10",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
  }[color];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold", c, className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-[11px] font-bold uppercase tracking-[.16em] text-bwo-amber">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      {Icon && <Icon className="mb-3 size-8 text-slate-500" />}
      <div className="font-semibold text-slate-200">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-slate-400">{children}</div>}
    </div>
  );
}

export function Spinner({ label = "Cargando…" }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" />{label}</div>;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      {String(error)}
      {onRetry && <button className="ml-3 underline" onClick={onRetry}>Reintentar</button>}
    </div>
  );
}
