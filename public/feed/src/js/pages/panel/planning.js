import {state,pillarOf,sortedPosts} from './state.js';
import {registerView} from './shell.js';
import {$,$$,setHTML} from '../../utils/ui.js';
import {esc,clip,pct} from '../../utils/format.js';
import {FORMATS,STATUS,MONTHS,DOW} from '../../config/constants.js';
import {today,dateKey,shortDate,shortStamp} from '../../utils/dates.js';
import {timeline} from '../../templates/timeline.js';
import {thumbOf} from '../../templates/gridCell.js';
import {openEditor} from './editor.js';
import {openStories} from '../../controllers/storyViewer.js';

/* ---------- Calendario ---------- */
function renderCalendar(){
  const c=state.cc,y=Math.floor(state.calMonth/12),m=state.calMonth%12;
  const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(),now=today();
  let cells='';
  for(let i=0;i<first;i++)cells+='<div class="cal-day empty"></div>';
  for(let d=1;d<=days;d++){
    const key=dateKey(y,m,d);
    const posts=c.posts.filter(p=>p.scheduled_date===key).map(p=>{
      const f=FORMATS[p.format]||FORMATS.post_v;
      return `<button class="mini-item" data-post="${p.id}"><span class="cdt" style="background:${pillarOf(c,p.pillar_id).color}"></span>
        <span>${f.icon} ${esc(clip(p.caption||f.label,14))}</span></button>`;}).join('');
    const stories=c.stories.map((s,i)=>[s,i]).filter(([s])=>s.scheduled_date===key)
      .map(([s,i])=>`<button class="mini-item" data-story="${i}"><span class="cdt" style="background:var(--brand-cerise)"></span>
        <span>📱 ${esc(clip(s.name||'Historia',14))}</span></button>`).join('');
    cells+=`<div class="cal-day${key===now?' today':''}"><div class="dn">${d}</div>${posts}${stories}</div>`;
  }
  setHTML('#main',`<header class="page-head"><div><h1>Calendario</h1><p>Programación de publicaciones e historias</p></div></header>
    <div class="cal-head"><button class="cal-nav" id="prevM" aria-label="Mes anterior">‹</button>
      <b>${MONTHS[m]} ${y}</b><button class="cal-nav" id="nextM" aria-label="Mes siguiente">›</button></div>
    <div class="cal-grid">${DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div>`);
  $('#prevM').addEventListener('click',()=>{state.calMonth--;renderCalendar();});
  $('#nextM').addEventListener('click',()=>{state.calMonth++;renderCalendar();});
  $$('[data-post]').forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.post)));
  $$('[data-story]').forEach(b=>b.addEventListener('click',()=>
    openStories(state.cc.stories,+b.dataset.story,{handle:state.cc.handle,photo:state.cc.photo})));
}

/* ---------- Analítica ---------- */
function bar(label,color,n,max,total){
  return `<div class="bar-row"><div class="bl"><span class="dot" style="background:${color}"></span>${esc(label)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${max?n/max*100:0}%;background:${color}"></div></div>
    <div class="bv">${n} · ${pct(n,total)}%</div></div>`;
}
function renderAnalytics(){
  const c=state.cc,P=c.posts,total=P.length||1;
  const by=s=>P.filter(p=>p.status===s).length;
  const pillars=c.pillars.map(p=>({...p,n:P.filter(x=>x.pillar_id===p.id).length}));
  const maxPil=Math.max(1,...pillars.map(p=>p.n));
  const fmts=Object.entries(FORMATS).map(([k,f])=>({...f,n:P.filter(p=>p.format===k).length})).filter(f=>f.n);
  const maxFmt=Math.max(1,...fmts.map(f=>f.n));
  const dated=P.filter(p=>p.scheduled_date).map(p=>p.scheduled_date).sort();
  let freq='—';
  if(dated.length>1){const span=(new Date(dated.at(-1))-new Date(dated[0]))/864e5;
    freq=(span>0?(dated.length/(span/7)).toFixed(1):dated.length)+'/sem';}
  const avg=P.length/(c.pillars.length||1);
  const weak=pillars.filter(p=>p.n<avg*0.4);
  const next=sortedPosts(c).filter(p=>p.status!=='published'&&p.scheduled_date>=today())
    .sort((a,b)=>(a.scheduled_date||'').localeCompare(b.scheduled_date||'')).slice(0,4);
  setHTML('#main',`<header class="page-head"><div><h1>Analítica</h1><p>@${esc(c.handle)} · meta ${esc(c.frequency_per_week||'—')}/sem</p></div></header>
    <div class="kpis">
      <div class="kpi" style="--accent:var(--brand-violet)"><div class="n">${P.length}</div><div class="l">Total</div></div>
      <div class="kpi" style="--accent:var(--brand-turquoise)"><div class="n">${by('published')}</div><div class="l">Publicadas</div><div class="sub">${pct(by('published'),total)}%</div></div>
      <div class="kpi" style="--accent:var(--brand-amber)"><div class="n">${P.length-by('published')}</div><div class="l">Por publicar</div><div class="sub">${by('approved')} aprob · ${by('pending')} pend</div></div>
      <div class="kpi" style="--accent:var(--brand-cerise)"><div class="n">${by('changes')}</div><div class="l">Con cambios</div></div>
      <div class="kpi" style="--accent:var(--brand-blue)"><div class="n">${freq}</div><div class="l">Frecuencia real</div></div></div>
    <div class="charts">
      <section class="card"><h3>🎨 Por pilar</h3>${pillars.map(p=>bar(p.name,p.color,p.n,maxPil,total)).join('')}
        <p class="balance-note ${weak.length?'warn':'good'}">${weak.length
          ?`⚠️ Poca presencia: ${esc(weak.map(p=>p.name).join(', '))}`:'✓ Distribución equilibrada entre pilares.'}</p></section>
      <section class="card"><h3>🎬 Por formato</h3>${fmts.map(f=>bar(f.label,'var(--brand-violet)',f.n,maxFmt,total)).join('')||'<p class="tl-empty">Sin datos.</p>'}</section>
      <section class="card"><h3>⏳ Aprobación</h3>${Object.entries(STATUS).map(([k,s])=>bar(s.label,s.color,by(k),total,total)).join('')}</section>
      <section class="card"><h3>📅 Próximas</h3>${next.length?next.map(p=>{
        const f=FORMATS[p.format]||FORMATS.post_v,s=STATUS[p.status];
        return `<button class="mini-item" data-post="${p.id}" style="padding:9px 11px;margin-bottom:8px">
          <span class="cdt" style="background:${pillarOf(c,p.pillar_id).color}"></span>
          <span>${f.icon} ${esc(clip(p.caption||f.label,30))}</span>
          <span class="right" style="color:${s.color}">${shortDate(p.scheduled_date)}</span></button>`;}).join('')
        :'<p class="tl-empty">Nada programado a futuro.</p>'}</section>
    </div>`);
  $$('[data-post]').forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.post)));
}

/* ---------- Bitácora ---------- */
let open=new Set(),filter='all';
function renderTimeline(){
  const c=state.cc;
  const posts=[...c.posts].sort((a,b)=>
    new Date(b.events?.at(-1)?.created_at||0)-new Date(a.events?.at(-1)?.created_at||0));
  const shown=filter==='all'?posts:posts.filter(p=>p.status===filter);
  setHTML('#main',`<header class="page-head"><div><h1>Bitácora</h1>
      <p>Historial completo de cada publicación: qué cambió, quién lo hizo y a qué hora</p></div></header>
    <div class="tl-filter">${[['all','Todas'],...Object.entries(STATUS).map(([k,s])=>[k,s.label])].map(([k,l])=>
      `<button class="chip${filter===k?' on':''}" data-f="${k}">${esc(l)}</button>`).join('')}</div>
    ${shown.length?shown.map(p=>{
      const f=FORMATS[p.format]||FORMATS.post_v,st=STATUS[p.status],src=thumbOf(p),isOpen=open.has(p.id);
      const last=p.events?.at(-1);
      return `<article class="tl-card"><div class="tl-card-h" data-toggle="${p.id}">
          <span class="th">${src?`<img src="${esc(src)}" alt="">`:''}</span>
          <span><span class="tt">${f.icon} ${esc(clip(p.caption||f.label,44))}</span>
            <span class="meta" style="color:${st.color}">${st.ico} ${st.label}</span>
            <span class="meta">${p.events?.length||0} movimiento(s)${last?` · último ${shortStamp(last.created_at)}`:''}</span></span>
          <span class="caret">${isOpen?'▾':'▸'}</span></div>
        ${isOpen?timeline(p.events||[]):''}</article>`;}).join('')
      :'<div class="state"><span class="icon">🕒</span>No hay publicaciones en este filtro.</div>'}`);
  $$('[data-f]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.f;renderTimeline();}));
  $$('[data-toggle]').forEach(h=>h.addEventListener('click',()=>{
    const id=h.dataset.toggle;open.has(id)?open.delete(id):open.add(id);renderTimeline();}));
}
registerView('calendar',renderCalendar);
registerView('analytics',renderAnalytics);
registerView('timeline',renderTimeline);
