import { handleClean } from "../logic.js";
import { LinkedText, ExternalLink } from "@/shared/ui/linked-text";

export default function ProfileHeader({ client, postsCount }) {
  const initials = (client.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-start gap-5 px-1 pb-4">
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-bwo-violet to-bwo-cerise p-[3px] sm:size-24">
        <div className="grid size-full place-items-center overflow-hidden rounded-full bg-bwo-inkDeep text-xl font-extrabold text-white">
          {client.photo ? <img src={client.photo} alt="" className="size-full object-cover" /> : initials}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold text-white">@{handleClean(client.handle) || "usuario"}</div>
        <div className="mt-2 flex gap-5 text-sm text-slate-300">
          <span><b className="text-white">{postsCount}</b> publicaciones</span>
          <span><b className="text-white">{client.followers || "—"}</b> seguidores</span>
          <span className="hidden sm:inline"><b className="text-white">{client.following || "—"}</b> seguidos</span>
        </div>
        <div className="mt-2 text-sm font-semibold text-white">{client.name}</div>
        {client.category && <div className="text-xs text-slate-400">{client.category}</div>}
        {client.bio && <LinkedText as="div" text={client.bio} className="mt-1 text-sm text-slate-300" />}
        {client.link && <div className="mt-1 truncate text-sm">🔗 <ExternalLink url={client.link} /></div>}
      </div>
    </div>
  );
}
