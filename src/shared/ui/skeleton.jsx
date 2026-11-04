import { cn } from "@/shared/lib/utils";

/* Skeletons de carga: bloques con la forma del contenido final y un brillo
   que recorre la pantalla. El brillo se apaga con «reducir movimiento». */
export function Skeleton({ className, style }) {
  return <div aria-hidden="true" className={cn("bwo-skel rounded-lg", className)} style={style} />;
}

const Header = () => (
  <div className="mb-6 space-y-2">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-8 w-72 max-w-full" />
    <Skeleton className="h-3.5 w-[28rem] max-w-full" />
  </div>
);
const CardBox = ({ children, className }) => <div className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-5", className)}>{children}</div>;

export function CardsSkeleton({ n = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: n }, (_, i) => (
        <CardBox key={i}><Skeleton className="mb-4 size-5" /><Skeleton className="h-9 w-20" /><Skeleton className="mt-2 h-3 w-36" /></CardBox>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <CardBox className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5" style={{ width: `${55 + ((i * 17) % 35)}%` }} /><Skeleton className="h-3 w-1/3" /></div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </CardBox>
  );
}

export function GridSkeleton({ cells = 18 }) {
  return (
    <div className="mx-auto w-full max-w-[380px] rounded-[2rem] border border-white/10 bg-black/40 p-3">
      <div className="mb-3 flex items-center gap-3 px-2 pt-2"><Skeleton className="size-16 rounded-full" /><div className="flex flex-1 justify-around">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-12" />)}</div></div>
      <Skeleton className="mx-2 mb-3 h-3 w-2/3" />
      <div className="grid grid-cols-3 gap-0.5">{Array.from({ length: cells }, (_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-none" />)}</div>
    </div>
  );
}

/** Esqueleto de página completa: cabecera + tarjetas + lista. */
export function PageSkeleton({ variant = "page" }) {
  if (variant === "list") return <div><Header /><ListSkeleton /></div>;
  if (variant === "grid") return <div><Header /><GridSkeleton /></div>;
  if (variant === "cards") return <div><Header /><CardsSkeleton /></div>;
  return (
    <div role="status" aria-label="Cargando">
      <Header />
      <CardsSkeleton />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]"><ListSkeleton rows={5} /><ListSkeleton rows={4} /></div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Esqueleto de toda la app mientras se valida la sesión (barra lateral + contenido). */
export function AppSkeleton() {
  return (
    <div className="bwo mx-auto flex min-h-screen max-w-[1600px] gap-5 p-3 sm:p-5" role="status" aria-label="Entrando">
      <div className="hidden h-[calc(100vh-2.5rem)] w-[264px] shrink-0 flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 lg:flex">
        <div className="mb-3 flex items-center gap-3"><Skeleton className="size-10 rounded-xl" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-2.5 w-32" /></div></div>
        <Skeleton className="h-10 rounded-xl" />
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9 rounded-xl" />)}
      </div>
      <div className="min-w-0 flex-1 pt-14 lg:pt-0"><PageSkeleton /></div>
      <span className="sr-only">Entrando…</span>
    </div>
  );
}
