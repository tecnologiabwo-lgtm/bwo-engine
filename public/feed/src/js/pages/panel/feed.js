import {state,pillarOf,sortedPosts,statusPatch} from './state.js';
import {registerView,render,refresh,toast} from './shell.js';
import {$,$$,setHTML} from '../../utils/ui.js';
import {esc,attr} from '../../utils/format.js';
import {STATUS,DIMS_REF} from '../../config/constants.js';
import {CLIENT_VIEW_URL} from '../../config/env.js';
import {profileHeader} from '../../templates/profileHeader.js';
import {gridCell,emptyCells} from '../../templates/gridCell.js';
import {paginate,pagerHTML} from '../../templates/pager.js';
import {createSortable} from '../../controllers/dragSort.js';
import {openStories} from '../../controllers/storyViewer.js';
import * as Posts from '../../services/posts.js';
import * as Events from '../../services/events.js';
import {openEditor} from './editor.js';

let destroySortable=null;

function renderFeed(){
  const c=state.cc;
  const posts=sortedPosts(c);
  const all=state.feedTab==='reels'?posts.filter(p=>p.format==='reel'):posts;
  const pg=paginate(all,state.feedPage);state.feedPage=pg.page;
  const list=pg.items;
  const min=state.feedTab==='reels'?3:9;
  const cells=list.map(p=>gridCell(p,{
    pillar:pillarOf(c,p.pillar_id),reelTab:state.feedTab==='reels',
    selectable:state.selMode,selected:state.selected.has(p.id),draggable:!state.selMode&&state.feedTab==='grid',
  })).join('')+emptyCells(min-list.length,state.feedTab==='reels');
  const link=`${CLIENT_VIEW_URL}?token=${c.share_token}`;
  const drafts=c.posts.filter(p=>p.status==='draft').length;
  const n=state.selected.size;
  const pillars=c.pillars.map(p=>({...p,n:c.posts.filter(x=>x.pillar_id===p.id).length}));
  const stats=Object.entries(STATUS).map(([k,s])=>({...s,n:c.posts.filter(x=>x.status===k).length}));

  setHTML('#main',`<header class="page-head">
      <div><h1>Feed & Perfil</h1><p>@${esc(c.handle)} · ${state.selMode?'toca para seleccionar':'mantén presionado y arrastra para reordenar'} · meta ${esc(c.frequency_per_week||'—')}/sem</p></div>
      <div class="btn-row"><button class="btn ghost" id="selBtn">${state.selMode?'✕ Cancelar':'☑ Seleccionar'}</button>
        <button class="btn" id="newBtn">＋ Nueva publicación</button></div></header>
    ${state.selMode?`<div class="bulkbar"><b>${n} seleccionada${n===1?'':'s'}</b>
      <button class="btn ghost sm" data-bulk="all">Todas</button><span class="spacer"></span>
      <button class="btn sm" data-bulk="pending" ${n?'':'disabled'}>📤 Enviar al cliente</button>
      <button class="btn ok sm" data-bulk="approved" ${n?'':'disabled'}>✓ Aprobar</button>
      <button class="btn ghost sm" data-bulk="published" ${n?'':'disabled'}>● Publicado</button>
      <button class="btn ghost sm" data-bulk="archive" ${n?'':'disabled'}>🗄 Archivar</button></div>`:''}
    <div class="feed-layout">
      <div class="phone"><div class="phone-screen">
        ${profileHeader(c,{postCount:c.posts.length,stories:c.stories,highlights:c.highlights,
          onStories:'window.P.stories(0)',tab:state.feedTab,onTab:'window.P.tab'})}
        <div class="ig-grid" id="igGrid">${cells}</div>${pagerHTML(pg,'window.P.page')}
      </div></div>
      <div class="side-panel">
        ${drafts?`<div class="share-box warn"><p>👁‍🗨 <b>${drafts}</b> borrador${drafts>1?'es':''} que el cliente <b>no ve</b> todavía.</p>
          <button class="btn sm" id="sendDrafts">📤 Enviar ${drafts>1?'todos ':''}al cliente</button></div>`:''}
        <div class="share-box"><h3>🔗 Link del cliente</h3><p class="url">${esc(link)}</p>
          <button class="btn sm" id="copyLink" data-link="${attr(link)}">Copiar link para el cliente</button></div>
        <section class="card"><h3>📍 Estado</h3><div class="status-legend">${stats.map(s=>
          `<span class="li"><span class="bar" style="background:${s.color}"></span>${s.label} · <b>${s.n}</b></span>`).join('')}</div></section>
        <section class="card"><h3>🎨 Pilares</h3><div class="legend">${pillars.map(p=>
          `<div class="li"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="ct">${p.n} pub.</span></div>`).join('')}</div></section>
        <section class="card"><h3>📐 Medidas</h3><div class="dims">${DIMS_REF.map(d=>
          `<div class="d"><span class="ico">${d.ico}</span><div><b>${d.name}</b><small>${d.note}</small></div><span class="px">${d.px}</span></div>`).join('')}</div></section>
      </div>
    </div>`);
  bind();
}
function bind(){
  $('#newBtn').addEventListener('click',()=>openEditor());
  $('#selBtn').addEventListener('click',()=>{state.selMode=!state.selMode;state.selected.clear();render();});
  $('#sendDrafts')?.addEventListener('click',sendDrafts);
  $('#copyLink').addEventListener('click',e=>navigator.clipboard.writeText(e.target.dataset.link).then(()=>toast('Link copiado ✓')));
  $$('[data-bulk]').forEach(b=>b.addEventListener('click',()=>bulk(b.dataset.bulk)));
  $$('#igGrid .ig-cell[data-id]').forEach(el=>el.addEventListener('click',()=>cellClick(el.dataset.id)));
  destroySortable?.();
  if(!state.selMode&&state.feedTab==='grid')
    destroySortable=createSortable($('#igGrid'),{onEnd:saveOrder});
}
function cellClick(id){
  if(!state.selMode){openEditor(id);return;}
  toggleSelect(id);
}
/** Actualiza solo la celda tocada y la barra: evita redibujar toda la cuadrícula. */
function toggleSelect(id){
  const wasOn=state.selected.has(id);
  wasOn?state.selected.delete(id):state.selected.add(id);
  const cell=$(`#igGrid .ig-cell[data-id="${id}"]`);
  if(cell){
    cell.classList.toggle('sel',!wasOn);
    const mark=cell.querySelector('.chk i');
    if(mark)mark.textContent=wasOn?'':'✓';
  }
  updateBulkBar();
}
function updateBulkBar(){
  const n=state.selected.size;
  const bar=document.querySelector('.bulkbar');
  if(!bar)return;
  bar.querySelector('b').textContent=`${n} seleccionada${n===1?'':'s'}`;
  bar.querySelectorAll('[data-bulk]').forEach(b=>{
    if(b.dataset.bulk==='all')return;
    n?b.removeAttribute('disabled'):b.setAttribute('disabled','');
  });
}
async function saveOrder(ids){
  try{
    // Solo se reordenó la página visible: se inserta ese tramo en el orden completo y se renumera
    const full=sortedPosts(state.cc).map(p=>p.id);
    const off=paginate(full,state.feedPage).offset;
    const merged=[...full.slice(0,off),...ids,...full.slice(off+ids.length)];
    await Posts.setOrder(merged.map((id,i)=>[id,i]),new Map(state.cc.posts.map(p=>[p.id,p.sort])));
    state.cc.posts.forEach(p=>{const i=merged.indexOf(p.id);if(i>=0)p.sort=i;});
    toast('Orden actualizado ✓');
  }catch(e){toast('No se pudo guardar el orden: '+e.message);await refresh();}
}
async function bulk(action){
  const ids=[...state.selected];
  if(action==='all'){
    const list=state.feedTab==='reels'?state.cc.posts.filter(p=>p.format==='reel'):state.cc.posts;
    list.forEach(p=>{if(!state.selected.has(p.id))toggleSelect(p.id);});
    return;
  }
  if(!ids.length)return;
  try{
    if(action==='archive'){
      if(!confirm(`¿Archivar ${ids.length} publicación(es)? Saldrán del feed y podrás restaurarlas.`))return;
      await Posts.updatePosts(ids,{archived:true});
      await Events.logEvents(ids,'archived');
    }else{
      await Posts.updatePosts(ids,statusPatch(action));
      await Events.logEvents(ids,action==='pending'?'sent':action);
    }
    state.selMode=false;state.selected.clear();
    await refresh();toast(`${ids.length} actualizada${ids.length>1?'s':''} ✓`);
  }catch(e){toast('Error: '+e.message);}
}
async function sendDrafts(){
  try{
    const ids=state.cc.posts.filter(p=>p.status==='draft').map(p=>p.id);
    await Posts.sendDrafts(state.cc.id);
    await Events.logEvents(ids,'sent');
    await refresh();toast('Enviado al cliente ✓');
  }catch(e){toast('Error: '+e.message);}
}
export function setTab(t){state.feedTab=t;state.feedPage=0;render();}
export function setPage(n){state.feedPage=n;render();document.getElementById('igGrid')?.scrollIntoView({block:'nearest'});}
export function playStories(i){
  const c=state.cc;openStories(c.stories,i,{handle:c.handle,photo:c.photo});
}
registerView('feed',renderFeed);
