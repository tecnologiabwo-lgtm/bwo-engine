/* Pruebas de la lógica del Feed en React. */
import { paginate, reorderPage, sortPosts, statusPatch, eventForStatus, thumbOf, stats, PAGE_CELLS, handleClean } from "../src/features/feed/logic.js";
let ok = 0, fail = 0;
const ok_ = (n, c) => (c ? ok++ : (fail++, console.log(`FALLA ${n}`)));
const eq = (n, g, w) => (JSON.stringify(g) === JSON.stringify(w) ? ok++ : (fail++, console.log(`FALLA ${n}: ${JSON.stringify(g)} ≠ ${JSON.stringify(w)}`)));
const posts = Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, sort: i, pinned: false, status: "pending" }));
eq("6×3 = 18", PAGE_CELLS, 18);
eq("página 1", paginate(posts, 0).items.length, 18);
eq("página 2", [paginate(posts, 1).items.length, paginate(posts, 1).offset], [7, 18]);
eq("página fuera de rango se acota", paginate(posts, 9).page, 1);
eq("lista vacía", paginate([], 0).pages, 1);
const pinned = sortPosts([{ id: "a", sort: 0 }, { id: "b", sort: 1, pinned: true }]);
eq("fijados primero", pinned.map((p) => p.id), ["b", "a"]);
// mover el último de la página 2 al inicio de la página 2
const page2 = paginate(posts, 1).items.map((p) => p.id);
const newPage2 = [page2.at(-1), ...page2.slice(0, -1)];
const r = reorderPage(posts, 18, newPage2);
eq("orden global conserva la página 1", r.order.slice(0, 18), posts.slice(0, 18).map((p) => p.id));
eq("solo cambian los de la página 2", r.changes.every(([id]) => +id.slice(1) >= 18), true);
eq("cantidad de cambios", r.changes.length, 7);
eq("aprobado fija fecha y autor", [statusPatch("approved", "Ana").status, statusPatch("approved", "Ana").approved_by, !!statusPatch("approved").approved_at], ["approved", "Ana", true]);
eq("borrador limpia aprobación", statusPatch("draft"), { status: "draft", approved_at: null, approved_by: null });
eq("publicado conserva aprobación", statusPatch("published"), { status: "published" });
eq("evento de envío", eventForStatus("pending"), "sent");
eq("sin evento para borrador", eventForStatus("draft"), null);
eq("miniatura de reel usa portada", thumbOf({ format: "reel", cover: "c", images: ["i"] }), "c");
eq("miniatura de post usa primera imagen", thumbOf({ format: "post_v", images: ["i1", "i2"] }), "i1");
const st = stats([{ status: "approved", pillar_id: "x", scheduled_date: "2026-11-01" }, { status: "pending", pillar_id: "x", scheduled_date: "2026-11-15" }], [{ id: "x", name: "Educar" }]);
eq("conteo por estado", [st.byStatus.approved, st.byStatus.pending], [1, 1]);
eq("frecuencia semanal", Math.round(st.perWeek * 10) / 10, 1);
eq("usuario limpio", handleClean("@Mi Marca.VE!"), "mimarca.ve");
// ── carga de trabajo
{
  const { workload, monthGrid, addDaysIso } = await import("../src/features/feed/logic.js");
  const ps = [
    { id: "a", scheduled_date: "2026-11-05", status: "draft" }, { id: "b", scheduled_date: "2026-11-05", status: "approved" },
    { id: "c", scheduled_date: "2026-11-07", status: "pending" }, { id: "d", scheduled_date: "2026-11-20", status: "draft" },
    { id: "e", scheduled_date: "2026-11-01", status: "changes" }, { id: "f", status: "draft" },
  ];
  const w = workload(ps, [{ scheduled_date: "2026-11-06" }], { from: "2026-11-04", days: 14, perWeek: 4 });
  ok_("14 días", w.days.length === 14);
  ok_("día con 2", w.days[1].total === 2 && w.days[1].notReady === 1);
  ok_("historias", w.days[2].stories === 1);
  ok_("próximos 7", w.summary.next7 === 3 && w.summary.notReady7 === 2 && w.summary.waitingClient7 === 1);
  ok_("días vacíos", w.summary.emptyDays7 === 5);
  ok_("brecha objetivo", w.summary.gap === -1);
  ok_("atrasados", w.summary.overdue === 1);
  ok_("más cargado", w.summary.busiest.date === "2026-11-05");
  ok_("fuera de rango no cuenta", !w.days.some((d) => d.posts.some((p) => p.id === "d")));
  ok_("cruce de mes", addDaysIso("2026-11-30", 1) === "2026-12-01");
  const g = monthGrid(2026, 10); // noviembre 2026 empieza en domingo
  ok_("mes en semanas completas", g.length % 7 === 0 && g[0].date === "2026-10-26" && g.filter((c) => c.inMonth).length === 30);
}

console.log(`FEED REACT · VERIFICACIONES: ${ok + fail} · OK: ${ok} · FALLOS: ${fail}`);
if (fail) process.exit(1);
