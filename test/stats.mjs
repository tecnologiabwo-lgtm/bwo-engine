/* Pruebas del histórico mensual del Consolidador. */
import { splitByMonth, rollup, daysPerMonth, periodKey } from "../src/features/consolidador/lib/stats.js";
let ok = 0, fail = 0;
const eq = (name, got, want) => {
  const pass = typeof want === "number" ? Math.abs(got - want) < 0.011 : JSON.stringify(got) === JSON.stringify(want);
  pass ? ok++ : (fail++, console.log(`FALLA ${name}: obtuvo ${JSON.stringify(got)}, esperaba ${JSON.stringify(want)}`));
};
const day = (label, spend, results, impressions = 100, reach = 50) => ({ label, spend, results, impressions, reach });

// 1) Desglose diario exacto que cruza dos meses
let s = splitByMonth({ level: "campaign", campaigns: [{ name: "Leads", objective: "Clientes potenciales", spend: 30, results: 6, igFollows: 9,
  dims: { day: [day("2026-09-30", 10, 2), day("2026-10-01", 20, 4)] } }] });
eq("diario: dos meses", s.months, ["2026-09-01", "2026-10-01"]);
eq("diario: inversión de septiembre", s.ads.find((a) => a.month === "2026-09-01").spend, 10);
eq("diario: resultados de octubre", s.ads.find((a) => a.month === "2026-10-01").results, 4);
eq("diario: seguidores repartidos por inversión", s.ads.find((a) => a.month === "2026-10-01").ig_follows, 6);
eq("diario: no es estimado", s.ads.every((a) => !a.prorated), true);

// 2) Sin diario, período dentro de un mes
s = splitByMonth({ campaigns: [{ name: "Msg", objective: "Mensajes", spend: 100, results: 10, impressions: 1000, reach: 500, period: { from: "2026-10-01", to: "2026-10-31" } }] });
eq("un mes: completo", [s.ads.length, s.ads[0].spend, s.ads[0].prorated], [1, 100, false]);

// 3) Sin diario, período que cruza meses → prorrateo por días
s = splitByMonth({ campaigns: [{ name: "X", objective: "", spend: 40, results: 4, period: { from: "2026-10-30", to: "2026-11-02" } }] });
eq("prorrateo: 2 días por mes", s.ads.map((a) => [a.month, a.spend, a.prorated]), [["2026-10-01", 20, true], ["2026-11-01", 20, true]]);
eq("prorrateo: aviso", s.warnings.some((w) => w.includes("estimado")), true);

// 4) Sin fechas → aviso y no se guarda
s = splitByMonth({ campaigns: [{ name: "Sin fecha", spend: 5, results: 1 }] });
eq("sin fechas: no se guarda", s.ads.length, 0);

// 5) Orgánico IG/FB por mes
s = splitByMonth({ campaigns: [] }, { reach: [{ date: "2026-10-01", value: 10 }, { date: "2026-10-02", value: 5 }, { date: "2026-11-01", value: 7 }], fbFollowers: [{ date: "2026-10-03", value: 3 }] });
eq("orgánico IG octubre", s.organic.find((o) => o.platform === "instagram" && o.month === "2026-10-01").value, 15);
eq("orgánico FB métrica", s.organic.find((o) => o.platform === "facebook").metric, "followers");
eq("orgánico: mes incompleto avisado", s.warnings.some((w) => w.startsWith("2026-10")), true);

// 6) Días por mes
eq("días por mes", daysPerMonth("2026-12-30", "2027-01-02"), { "2026-12-01": 2, "2027-01-01": 2 });
eq("trimestre", periodKey("2026-11-01", "quarter"), "2026-T4");

// 7) Revisión por período
const ads = [
  { month: "2025-10-01", entity: "A", objective: "L", spend: 50, results: 5, impressions: 1000 },
  { month: "2026-07-01", entity: "A", objective: "L", spend: 90, results: 9, impressions: 1000 },
  { month: "2026-09-01", entity: "A", objective: "L", spend: 100, results: 10, impressions: 2000 },
  { month: "2026-10-01", entity: "A", objective: "L", spend: 120, results: 20, impressions: 3000 },
  { month: "2026-10-01", entity: "B", objective: "M", spend: 30, results: 3, impressions: 500 },
];
let r = rollup(ads, [], "month");
const oct = r.find((p) => p.key === "2026-10");
eq("mes: inversión total", oct.spend, 150);
eq("mes: CPL", oct.cpl, 6.52);
eq("mes: vs anterior (+50 %)", oct.vsPrev.spend, 0.5);
eq("mes: vs año anterior (+200 %)", oct.vsYear.spend, 2);
eq("mes: entidades ordenadas por inversión", oct.entities.map((e) => e.entity), ["A", "B"]);
eq("mes: por objetivo", oct.byObjective.L.results, 20);
r = rollup(ads, [], "quarter");
eq("trimestres", r.map((p) => p.key), ["2025-T4", "2026-T3", "2026-T4"]);
eq("T3 suma 2 meses", [r[1].spend, r[1].months, r[1].complete], [190, 2, false]);
eq("T4 2026 vs T3 (anterior)", r[2].vsPrev.spend, (150 - 190) / 190);
eq("T4 2026 vs T4 2025", r[2].vsYear.spend, 2);
r = rollup(ads, [{ month: "2026-10-01", platform: "instagram", metric: "followers", value: 40 }], "year");
eq("año 2026", [r[1].key, r[1].spend, r[1].organic["instagram.followers"]], ["2026", 340, 40]);
eq("año vs año", r[1].vsPrev.spend, (340 - 50) / 50);
eq("año sin interanual", r[1].vsYear, null);
eq("sin resultados no divide por cero", rollup([{ month: "2026-01-01", entity: "Z", spend: 10, results: 0 }])[0].cpl, null);

console.log(`HISTÓRICO CONSOLIDADOR · VERIFICACIONES: ${ok + fail} · OK: ${ok} · FALLOS: ${fail}`);
if (fail) process.exit(1);
