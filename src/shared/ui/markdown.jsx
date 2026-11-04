import { Fragment } from "react";
import { LinkedText } from "./linked-text.jsx";
import { safeHref } from "@/shared/lib/linkify";

/* Markdown mínimo y seguro (sin HTML): ## / ###, párrafos, listas -, 1.,
   > citas, **negrita**, _cursiva_, `código`, [texto](url) y enlaces sueltos. */
function inline(text, key = "i") {
  const out = []; let rest = text, k = 0;
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/;
  while (rest) {
    const m = rest.match(re);
    if (!m) { out.push(<LinkedText key={`${key}${k++}`} text={rest} className="whitespace-normal" />); break; }
    if (m.index) out.push(<LinkedText key={`${key}${k++}`} text={rest.slice(0, m.index)} className="whitespace-normal" />);
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}${k++}`} className="font-bold text-white">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("_")) out.push(<em key={`${key}${k++}`}>{t.slice(1, -1)}</em>);
    else if (t.startsWith("`")) out.push(<code key={`${key}${k++}`} className="rounded bg-white/10 px-1 py-0.5 text-[.9em] text-bwo-amber">{t.slice(1, -1)}</code>);
    else { const [, label, url] = t.match(/\[([^\]]+)\]\(([^)]+)\)/); const internal = url.startsWith("/");
      const href = internal ? url : safeHref(url);
      out.push(href ? <a key={`${key}${k++}`} href={href} {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })} className="font-semibold text-bwo-turquoiseLt underline-offset-2 hover:underline">{label}</a> : <Fragment key={`${key}${k++}`}>{label}</Fragment>); }
    rest = rest.slice(m.index + t.length);
  }
  return out;
}

export function Markdown({ source }) {
  const lines = String(source || "").replace(/\r/g, "").split("\n");
  const blocks = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^###\s/.test(l)) { blocks.push(<h3 key={i} className="mb-2 mt-6 text-base font-bold text-white">{inline(l.slice(4), `h${i}`)}</h3>); i++; continue; }
    if (/^##\s/.test(l)) { blocks.push(<h2 key={i} className="mb-3 mt-8 text-lg font-extrabold text-white first:mt-0">{inline(l.slice(3), `h${i}`)}</h2>); i++; continue; }
    if (/^>\s?/.test(l)) { const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={i} className="my-4 rounded-r-xl border-l-4 border-bwo-amber bg-bwo-amber/5 px-4 py-3 text-slate-200">{inline(q.join(" "), `q${i}`)}</blockquote>); continue; }
    if (/^\s*[-*]\s/.test(l) || /^\s*\d+\.\s/.test(l)) {
      const ordered = /^\s*\d+\./.test(l), items = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s/ : /^\s*[-*]\s/).test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s/, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(<Tag key={i} className={`my-3 space-y-1.5 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-bwo-violetLt`}>{items.map((it, j) => <li key={j}>{inline(it, `l${i}-${j}`)}</li>)}</Tag>); continue; }
    const p = []; while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) p.push(lines[i++]);
    blocks.push(<p key={i} className="my-3 leading-relaxed">{inline(p.join(" "), `p${i}`)}</p>);
  }
  return <div className="text-sm text-slate-300">{blocks}</div>;
}
