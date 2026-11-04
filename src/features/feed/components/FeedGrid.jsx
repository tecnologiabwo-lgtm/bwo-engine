import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Pin, Film, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { STATUS, COLS, thumbOf, formatOf } from "../logic.js";
import { cn } from "@/shared/lib/utils";

function Cell({ post, pillar, selected, onOpen, onToggle, selectable, sortable }) {
  const s = useSortable({ id: post.id, disabled: !sortable });
  const st = STATUS[post.status] || STATUS.draft;
  const img = thumbOf(post), fmt = formatOf(post);
  return (
    <div ref={s.setNodeRef} style={{ transform: CSS.Transform.toString(s.transform), transition: s.transition, zIndex: s.isDragging ? 10 : undefined }}
      className={cn("group relative aspect-[4/5] overflow-hidden bg-white/5 outline-none", s.isDragging && "opacity-80 ring-2 ring-bwo-violet", selected && "ring-2 ring-inset ring-bwo-turquoise")}
      {...(sortable ? { ...s.attributes, ...s.listeners, role: undefined, "aria-roledescription": "publicación arrastrable" } : {})}>
      <button type="button" className="absolute inset-0 size-full" onClick={() => onOpen(post)} aria-label={`Abrir publicación: ${st.label}`}>
        {img ? <img src={img} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
          : <div className="grid size-full place-items-center text-3xl text-slate-600">{fmt.icon}</div>}
      </button>
      <div className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1">
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow" style={{ background: st.color }}>{st.ico} {st.label}</span>
      </div>
      <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1 text-white drop-shadow">
        {post.pinned && <Pin className="size-4" />}
        {post.format === "reel" && <Film className="size-4" />}
        {post.format === "carousel" && <Layers className="size-4" />}
      </div>
      {pillar && <span className="pointer-events-none absolute bottom-0 left-0 h-1 w-full" style={{ background: pillar.color }} />}
      {post.scheduled_date && <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1 text-[10px] text-white">{post.scheduled_date.slice(5).split("-").reverse().join("/")}</span>}
      {selectable && (
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToggle(post.id); }}
          aria-label={selected ? "Quitar de la selección" : "Seleccionar"}
          className={cn("absolute bottom-1.5 right-1.5 grid size-6 place-items-center rounded-full border-2 transition",
            selected ? "border-bwo-turquoise bg-bwo-turquoise text-bwo-inkDeep" : "border-white/80 bg-black/40 text-transparent opacity-0 group-hover:opacity-100 focus:opacity-100")}>
          <Check className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export default function FeedGrid({ page, pillars, selected, onToggle, onOpen, onReorder, onPage, sortable, selectable }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = page.items.map((p) => p.id);
  const pmap = Object.fromEntries(pillars.map((p) => [p.id, p]));
  const end = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)));
  };
  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}>
            {page.items.map((p) => <Cell key={p.id} post={p} pillar={pmap[p.pillar_id]} selected={selected.has(p.id)} onToggle={onToggle} onOpen={onOpen} selectable={selectable} sortable={sortable} />)}
          </div>
        </SortableContext>
      </DndContext>
      {page.pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm text-slate-300">
          <button className="grid size-8 place-items-center rounded-lg bg-white/5 disabled:opacity-30" disabled={page.page === 0} onClick={() => onPage(page.page - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></button>
          <span>Página {page.page + 1} de {page.pages} · {page.total} publicaciones</span>
          <button className="grid size-8 place-items-center rounded-lg bg-white/5 disabled:opacity-30" disabled={page.page >= page.pages - 1} onClick={() => onPage(page.page + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
