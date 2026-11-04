import { Plus, X } from "lucide-react";
import { useToast } from "@/shared/ui/toast";
import { uploadImage, pickFiles } from "../media.js";
import * as api from "../api.js";

function Bubble({ img, label, onRemove, ring }) {
  return (
    <div className="group relative flex w-16 shrink-0 flex-col items-center gap-1">
      <div className={"size-16 rounded-full p-[2px] " + (ring ? "bg-gradient-to-tr from-bwo-amber via-bwo-cerise to-bwo-violet" : "bg-white/20")}>
        <div className="size-full overflow-hidden rounded-full border-2 border-bwo-inkDeep bg-white/10">{img && <img src={img} alt="" className="size-full object-cover" />}</div>
      </div>
      <span className="w-full truncate text-center text-[11px] text-slate-300">{label}</span>
      {onRemove && <button onClick={onRemove} className="absolute -right-1 -top-1 hidden size-5 place-items-center rounded-full bg-bwo-cerise text-white group-hover:grid" aria-label={`Quitar ${label}`}><X className="size-3" /></button>}
    </div>
  );
}

export default function StoriesBar({ client, stories, highlights, isAdmin, onChanged }) {
  const toast = useToast();
  const add = async (kind) => {
    const [f] = await pickFiles(); if (!f) return;
    const name = prompt(kind === "story" ? "Nombre de la historia" : "Nombre del destacado", kind === "story" ? "Historia" : "Destacado"); if (name == null) return;
    try {
      const dims = kind === "story" ? { w: 1080, h: 1920 } : { w: 320, h: 320, targetKB: 60 };
      const { url } = await uploadImage(client.id, f, dims);
      if (kind === "story") await api.addStory({ client_id: client.id, name, img: url, sort: stories.length });
      else await api.addHighlight({ client_id: client.id, name, cover: url, sort: highlights.length });
      onChanged();
    } catch (e) { toast(e.message, "error"); }
  };
  const del = (fn) => confirm("¿Quitar?") && fn().then(onChanged).catch((e) => toast(e.message, "error"));
  if (!isAdmin && !stories.length && !highlights.length) return null;
  return (
    <div className="flex gap-3 overflow-x-auto px-1 pb-4">
      {highlights.map((h) => <Bubble key={h.id} img={h.cover} label={h.name} onRemove={isAdmin && (() => del(() => api.deleteHighlight(h.id)))} />)}
      {stories.map((s) => <Bubble key={s.id} ring img={s.img} label={s.name} onRemove={isAdmin && (() => del(() => api.deleteStory(s.id)))} />)}
      {isAdmin && <>
        <button onClick={() => add("highlight")} className="flex w-16 shrink-0 flex-col items-center gap-1 text-slate-400 hover:text-white"><span className="grid size-16 place-items-center rounded-full border border-dashed border-white/30"><Plus className="size-5" /></span><span className="text-[11px]">Destacado</span></button>
        <button onClick={() => add("story")} className="flex w-16 shrink-0 flex-col items-center gap-1 text-slate-400 hover:text-white"><span className="grid size-16 place-items-center rounded-full border border-dashed border-white/30"><Plus className="size-5" /></span><span className="text-[11px]">Historia</span></button>
      </>}
    </div>
  );
}
