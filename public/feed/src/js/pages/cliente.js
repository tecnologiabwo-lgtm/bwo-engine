import {BRAND} from '../config/env.js';
import {FORMATS,STATUS} from '../config/constants.js';
import {$,$$,setHTML,toast,closeModal,loadingState} from '../utils/ui.js';
import {esc,clip} from '../utils/format.js';
import {shortDate,longDate,stamp} from '../utils/dates.js';
import {profileHeader} from '../templates/profileHeader.js';
import {gridCell,emptyCells} from '../templates/gridCell.js';
import {timeline} from '../templates/timeline.js';
import {openStories} from '../controllers/storyViewer.js';
import {bindZoom,openZoom} from '../controllers/zoomView.js';
import * as Portal from '../services/clientPortal.js';

const token=new URLSearchParams(location.search).get('token');
let busy=false;
const st={data:null,tab:'grid',selMode:false,selected:new Set(),idx:0,post:null};
const pillarOf=id=>(st.data.pillars||[]).find(p=>p.id===id)||{name:'—',color:'var(--text-faint)'};
const canAct=p=>['pending','changes'].includes(p.status);
const logo=()=>BRAND.logo?`<span class="brand-logo"><img src="${BRAND.logo}" alt=""></span>`:`<span class="brand-logo">${BRAND.initials}</span>`;

async function load(){
  if(!token){setHTML('#root','<div class="loader">Link inválido. Pide a Big Way Offices tu enlace de acceso.</div>');return;}
  setHTML('#root',loadingState('Cargando tu feed…'));
  try{
    const res=await Portal.fetchFeed(token);
    if(!res||!res.client){setHTML('#root','<div class="loader">No encontramos este feed.<br>Verifica el enlace con Big Way Offices.</div>');return;}
    res.posts=(res.posts||[]).filter(p=>p.status!=='draft');
    res.stories=res.stories||[];
    st.data=res;render();
  }catch(e){
    setHTML('#root',`<div class="state error"><span class="icon">⚠️</span>No pudimos cargar tu feed: ${esc(e.message)}
      <div><button class="btn ghost" id="retry">Reintentar</button></div></div>`);
    $('#retry').addEventListener('click',load);
  }
}
function render(){
  const c=st.data.client,posts=st.data.posts;
  const list=st.tab==='reels'?posts.filter(p=>p.format==='reel'):posts;
  const min=st.tab==='reels'?3:9;
  const cells=list.map(p=>gridCell(p,{pillar:pillarOf(p.pillar_id),reelTab:st.tab==='reels',
    selectable:st.selMode&&canAct(p),selected:st.selected.has(p.id),locked:st.selMode&&!canAct(p)})).join('')
    +emptyCells(min-list.length,st.tab==='reels');
  const pending=posts.filter(p=>p.status==='pending');
  const actionable=posts.filter(canAct);
  const pillars=(st.data.pillars||[]).map(p=>({...p,n:posts.filter(x=>x.pillar_id===p.id).length}));
  setHTML('#root',`<div class="wrap">
    <header class="topbar">${logo()}<div><b>Feed de @${esc(c.handle)}</b><small class="brand-sub">Revisión de contenido · ${esc(BRAND.owner)}</small></div>
      ${actionable.length?`<div class="btn-row" style="margin-left:auto"><button class="btn ghost sm" id="selBtn">${st.selMode?'✕ Cancelar':'☑ Seleccionar varias'}</button></div>`:''}</header>
    ${pending.length&&!st.selMode?`<div class="pend-banner">⏳ <span>Tienes <b>${pending.length}</b> publicación${pending.length>1?'es':''} esperando tu aprobación.</span>
      <button class="btn ok sm" id="approveAll">✓ Aprobar ${pending.length>1?'todas':''}</button></div>`:''}
    <div class="grid2">
      <div class="phone"><div class="phone-screen">
        ${profileHeader(c,{postCount:posts.length,stories:st.data.stories,highlights:st.data.highlights||[],
          onStories:'window.C.stories(0)',tab:st.tab,onTab:'window.C.tab'})}
        <div class="ig-grid">${cells}</div></div></div>
      <div class="side">
        <section class="card"><h3>👋 ¿Cómo revisar?</h3>
          <p>Así se verá tu feed. Toca una publicación para ver el copy y las imágenes y <b>aprobarla</b> o <b>pedir cambios</b>. Con <b>Seleccionar varias</b> respondes en bloque.</p>
          <div class="badge-legend" style="margin-top:12px">${['pending','changes','approved','published'].map(k=>
            `<span><i style="background:${STATUS[k].color}">${STATUS[k].ico}</i>${STATUS[k].clientLabel.replace(' de tu aprobación','')}</span>`).join('')}</div></section>
        ${st.data.stories.length?`<section class="card"><h3>📱 Historias (${st.data.stories.length})</h3>
          <div class="st-strip">${st.data.stories.map((s,i)=>`<button class="st-th" data-story="${i}">
            <span class="fr">${s.img?`<img src="${esc(s.img)}" alt="">`:''}</span>
            <span>${s.scheduled_date?shortDate(s.scheduled_date):esc(clip(s.name||'',10))}</span></button>`).join('')}</div></section>`:''}
        ${actionable.length?`<section class="card"><h3>📋 Por revisar (${actionable.length})</h3><div class="q-list">${actionable.map(p=>{
          const s=STATUS[p.status],f=FORMATS[p.format]||FORMATS.post_v;
          return `<button class="q-item" data-open="${p.id}"><span class="cdt" style="background:${pillarOf(p.pillar_id).color}"></span>
            <span>${f.icon} ${esc(clip(p.caption||f.short,26))}</span>
            <span class="st" style="color:${s.color}">${shortDate(p.scheduled_date)} ${s.ico}</span></button>`;}).join('')}</div></section>`:''}
        <section class="card"><h3>🎨 Pilares</h3><div class="legend">${pillars.map(p=>
          `<div class="li"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}<span class="ct">${p.n} pub.</span></div>`).join('')}</div></section>
      </div></div></div>`);
  bind();
}
function bind(){
  $('#selBtn')?.addEventListener('click',()=>{st.selMode=!st.selMode;st.selected.clear();render();});
  $('#approveAll')?.addEventListener('click',approveAllPending);
  $$('[data-open]').forEach(b=>b.addEventListener('click',()=>openPost(b.dataset.open)));
  $$('[data-story]').forEach(b=>b.addEventListener('click',()=>playStories(+b.dataset.story)));
  $$('.ig-grid .ig-cell[data-id]').forEach(el=>el.addEventListener('click',()=>cellClick(el.dataset.id)));
  renderSelBar();
}
function renderSelBar(){
  const n=st.selected.size;
  setHTML('#selRoot',st.selMode?`<div class="selbar"><b>${n} seleccionada${n===1?'':'s'}</b>
    <button class="btn ghost sm" id="selAll">Todas</button>
    <button class="btn ok sm" id="selOk" ${n?'':'disabled'}>✓ Aprobar</button>
    <button class="btn bad sm" id="selNo" ${n?'':'disabled'}>↺ Pedir cambios</button></div>`:'');
  $('#selAll')?.addEventListener('click',()=>{
    st.data.posts.filter(canAct).forEach(p=>{if(!st.selected.has(p.id))toggleSelect(p.id);});});
  $('#selOk')?.addEventListener('click',()=>approve([...st.selected]));
  $('#selNo')?.addEventListener('click',()=>askChanges([...st.selected]));
}
function cellClick(id){
  const p=st.data.posts.find(x=>x.id===id);
  if(!st.selMode){openPost(id);return;}
  if(!canAct(p)){toast(`Esta publicación ya está ${p.status==='approved'?'aprobada':'publicada'}`);return;}
  toggleSelect(id);
}
/** Actualiza solo la celda tocada: la cuadrícula no parpadea. */
function toggleSelect(id){
  const wasOn=st.selected.has(id);
  wasOn?st.selected.delete(id):st.selected.add(id);
  const cell=document.querySelector(`.ig-grid .ig-cell[data-id="${id}"]`);
  if(cell){
    cell.classList.toggle('sel',!wasOn);
    const mark=cell.querySelector('.chk i');
    if(mark)mark.textContent=wasOn?'':'✓';
  }
  renderSelBar();
}
const playStories=i=>openStories(st.data.stories,i,{handle:st.data.client.handle,photo:st.data.client.photo});

function openPost(id){st.post=st.data.posts.find(p=>p.id===id);st.idx=0;renderPost();}
function renderPost(){
  const p=st.post,f=FORMATS[p.format]||FORMATS.post_v,s=STATUS[p.status],pil=pillarOf(p.pillar_id);
  const isReel=p.format==='reel';
  const imgs=isReel?[p.cover].filter(Boolean):(p.images||[]);
  const cur=imgs[st.idx];
  setHTML('#modalRoot',`<div class="modal-bg" id="pbg"><div class="modal" role="dialog" aria-label="Revisar publicación">
    <header class="modal-h"><b>Revisar publicación</b><button class="modal-x" id="pClose" aria-label="Cerrar">✕</button></header>
    <div class="modal-body split"><div>
      <div class="prev-frame">
        ${cur?`<img src="${esc(cur)}" alt="" style="aspect-ratio:${f.aspect};object-fit:cover">`
          :`<div class="empty" style="aspect-ratio:${f.aspect}"><span class="big">${f.icon}</span></div>`}
        ${imgs.length>1?`${st.idx>0?'<button class="nav l" id="pPrev" aria-label="Anterior">‹</button>':''}
          ${st.idx<imgs.length-1?'<button class="nav r" id="pNext" aria-label="Siguiente">›</button>':''}
          <span class="count">${st.idx+1}/${imgs.length}</span>`:''}
        ${isReel?'<span class="count">▶ Portada del reel</span>':''}
        ${cur?'<button class="zoom-open" id="pZoom" aria-label="Ampliar imagen">⤢</button>':''}</div>
      <p class="hint center">Toca dos veces la imagen o pellizca para ampliarla</p>
      ${imgs.length>1?`<div class="carousel-dots">${imgs.map((_,i)=>`<span class="cd${i===st.idx?' on':''}"></span>`).join('')}</div>`:''}
      ${isReel&&p.cover?`<p class="rp-lbl" style="margin-top:12px">Así se verá en tu feed</p>
        <div class="rp-frame r34" style="width:48%"><img src="${esc(p.cover)}" alt=""></div>`:''}</div>
      <div>
        <span class="tag" style="background:var(--brand-violet)">${f.icon} ${f.short}</span>
        <span class="tag" style="background:${pil.color}">${esc(pil.name)}</span>
        <div><span class="status-chip" style="background:color-mix(in srgb,${s.color} 15%,transparent);color:${s.color}">${s.ico} ${s.clientLabel}</span></div>
        ${p.scheduled_date?`<p class="datebox">📅 Publicación estimada: <b>${longDate(p.scheduled_date)}</b></p>`:''}
        ${p.approved_at?`<p class="okbox">✓ <b>Aprobado</b> el ${stamp(p.approved_at)} por <b>${esc(p.approved_by||'')}</b></p>`:''}
        ${p.caption?`<p class="cap">${esc(p.caption)}</p>`:''}
        ${canAct(p)?`<div class="actions"><button class="btn ok" id="pOk">✓ Aprobar</button><button class="btn bad" id="pNo">↺ Pedir cambios</button></div>`
          :p.status==='approved'?`<div class="actions"><button class="btn ghost" id="pNo">↺ Pedir un cambio de última hora</button></div>`:''}
        <div class="cbox" id="cbox" hidden><textarea id="cText" maxlength="2000" placeholder="¿Qué te gustaría cambiar? (texto, imagen, fecha…)"></textarea>
          <button class="btn ghost block" id="cSend" style="margin-top:8px">Enviar comentario</button></div>
        <p class="label">Historial de esta publicación</p>${timeline(p.events||[])}
      </div></div></div></div>`);
  const zoomList=()=>isReel?[p.cover].filter(Boolean):(p.images||[]);
  bindZoom($('#pbg').querySelector('.prev-frame img'),zoomList,()=>st.idx);
  $('#pZoom')?.addEventListener('click',()=>openZoom(zoomList(),st.idx));
  $('#pbg').addEventListener('click',e=>{if(e.target.id==='pbg')closeModal();});
  $('#pClose').addEventListener('click',closeModal);
  $('#pPrev')?.addEventListener('click',()=>{st.idx--;renderPost();});
  $('#pNext')?.addEventListener('click',()=>{st.idx++;renderPost();});
  $('#pOk')?.addEventListener('click',()=>approve([p.id]));
  $('#pNo')?.addEventListener('click',()=>{$('#cbox').hidden=false;$('#cText').focus();});
  $('#cSend')?.addEventListener('click',()=>sendChanges([p.id],$('#cText').value));
}
function askChanges(ids){
  setHTML('#modalRoot',`<div class="modal-bg" id="abg"><div class="modal narrow" role="dialog">
    <header class="modal-h"><b>Pedir cambios en ${ids.length} publicación${ids.length>1?'es':''}</b>
      <button class="modal-x" id="aClose" aria-label="Cerrar">✕</button></header>
    <div class="modal-body"><div class="cbox"><textarea id="cText" maxlength="2000"
      placeholder="Describe qué cambiar. Se aplicará el mismo comentario a todas las seleccionadas."></textarea>
      <button class="btn bad block" id="aSend" style="margin-top:10px">Enviar comentario</button></div></div></div></div>`);
  $('#abg').addEventListener('click',e=>{if(e.target.id==='abg')closeModal();});
  $('#aClose').addEventListener('click',closeModal);
  $('#aSend').addEventListener('click',()=>sendChanges(ids,$('#cText').value));
  $('#cText').focus();
}
async function approve(ids){
  if(!ids.length||busy)return;
  busy=true;
  document.querySelectorAll('.btn.ok,.btn.bad').forEach(b=>b.setAttribute('disabled',''));
  try{
    await Portal.approvePosts(token,ids);
    toast(ids.length>1?`¡${ids.length} publicaciones aprobadas! ✓`:'¡Aprobada! Gracias ✓');
    st.selMode=false;st.selected.clear();closeModal();await load();
  }catch(e){
    toast('No se pudo guardar: '+e.message);
    document.querySelectorAll('[disabled]').forEach(b=>b.removeAttribute('disabled'));
  }finally{busy=false;}
}
async function approveAllPending(){
  const ids=st.data.posts.filter(p=>p.status==='pending').map(p=>p.id);
  if(ids.length>1&&!confirm(`¿Aprobar las ${ids.length} publicaciones pendientes?`))return;
  approve(ids);
}
async function sendChanges(ids,text){
  const t=(text||'').trim();
  if(!t){toast('Escribe qué cambiar');return;}
  if(busy)return;
  busy=true;
  try{
    await Portal.requestChanges(token,ids,t);
    toast('Comentario enviado ✓');
    st.selMode=false;st.selected.clear();closeModal();await load();
  }catch(e){toast('No se pudo enviar: '+e.message);}
  finally{busy=false;}
}
window.C={tab:t=>{st.tab=t;render();},stories:playStories};
load();
