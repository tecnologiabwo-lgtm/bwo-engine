import {state} from './state.js';
import {registerView,refresh,toast} from './shell.js';
import {$,$$,setHTML} from '../../utils/ui.js';
import {esc} from '../../utils/format.js';
import {today} from '../../utils/dates.js';
import {pickImage} from '../../utils/imageCompress.js';
import {openStories} from '../../controllers/storyViewer.js';
import * as Media from '../../services/media.js';

const playAll=i=>openStories(state.cc.stories,i,{handle:state.cc.handle,photo:state.cc.photo});

function renderStories(){
  const c=state.cc;
  setHTML('#main',`<header class="page-head">
      <div><h1>Historias</h1><p>1080×1920 (9:16) · las franjas rayadas marcan dónde no poner texto · toca una para verla como en Instagram</p></div>
      <div class="btn-row">${c.stories.length?'<button class="btn ghost" id="playAll">▶ Reproducir todas</button>':''}
        <button class="btn" id="addStory">＋ Añadir</button></div></header>
    ${c.stories.length?`<div class="strip">${c.stories.map((s,i)=>`<div class="story-card">
        <button class="story-frame" data-play="${i}" aria-label="Ver ${esc(s.name||'historia')}">
          ${s.img?`<img src="${esc(s.img)}" alt="">`:'📱'}<span class="zone top"></span><span class="zone bot"></span><span class="play">▶</span></button>
        <p class="cap">${esc(s.name||'Historia')}</p>
        <input type="date" class="sdate" value="${esc(s.scheduled_date||'')}" data-date="${s.id}" aria-label="Fecha estimada">
        <button class="btn ghost sm block" data-del="${s.id}" style="margin-top:6px">Quitar</button></div>`).join('')}
      <div class="story-card"><button class="story-add" id="addStory2" aria-label="Nueva historia">＋</button><p class="cap">Nueva</p></div></div>`
    :`<div class="state"><span class="icon">📱</span>Aún no hay historias planificadas.
       <div><button class="btn" id="addStory3">＋ Añadir la primera</button></div></div>`}`);
  ['addStory','addStory2','addStory3'].forEach(id=>$('#'+id)?.addEventListener('click',addStory));
  $('#playAll')?.addEventListener('click',()=>playAll(0));
  $$('[data-play]').forEach(b=>b.addEventListener('click',()=>playAll(+b.dataset.play)));
  $$('[data-del]').forEach(b=>b.addEventListener('click',()=>del(b.dataset.del)));
  $$('[data-date]').forEach(i=>i.addEventListener('change',()=>setDate(i.dataset.date,i.value)));
}
function addStory(){
  pickImage(async r=>{
    const name=prompt('Nombre de la historia:','Historia')||'Historia';
    try{await Media.addStory({client_id:state.cc.id,name,img:r.dataUrl,scheduled_date:today(),sort:state.cc.stories.length});
      await refresh();toast('Historia añadida ✓');}
    catch(e){toast('Error: '+e.message);}
  },{w:1080,h:1920,targetKB:200},e=>toast('No se pudo procesar: '+e.message));
}
async function setDate(id,v){try{await Media.updateStory(id,{scheduled_date:v||null});
  const s=state.cc.stories.find(x=>x.id===id);if(s)s.scheduled_date=v;}catch(e){toast('Error: '+e.message);}}
async function del(id){try{await Media.deleteStory(id);await refresh();}catch(e){toast('Error: '+e.message);}}

function renderHighlights(){
  const c=state.cc;
  setHTML('#main',`<header class="page-head">
      <div><h1>Destacadas</h1><p>Se ven en círculo de ~161px · sube 1080×1920 y deja el sujeto al centro</p></div>
      <button class="btn" id="addHl">＋ Nueva</button></header>
    ${c.highlights.length?`<div class="hl-strip">${c.highlights.map(h=>`<div class="hl-item">
        <button class="circle" data-cover="${h.id}" aria-label="Cambiar portada de ${esc(h.name)}">${h.cover?`<img src="${esc(h.cover)}" alt="">`:'＋'}</button>
        <p class="nm">${esc(h.name)}</p>
        <button class="btn ghost sm" data-hdel="${h.id}" style="margin-top:6px">Quitar</button></div>`).join('')}</div>`
    :`<div class="state"><span class="icon">⭕</span>Sin destacadas todavía.</div>`}`);
  $('#addHl').addEventListener('click',addHl);
  $$('[data-cover]').forEach(b=>b.addEventListener('click',()=>setCover(b.dataset.cover)));
  $$('[data-hdel]').forEach(b=>b.addEventListener('click',()=>delHl(b.dataset.hdel)));
}
async function addHl(){
  const name=prompt('Nombre de la destacada:');if(!name)return;
  try{await Media.addHighlight({client_id:state.cc.id,name,sort:state.cc.highlights.length});await refresh();}
  catch(e){toast('Error: '+e.message);}
}
function setCover(id){pickImage(async r=>{try{await Media.updateHighlight(id,{cover:r.dataUrl});await refresh();}
  catch(e){toast('Error: '+e.message);}},{w:1080,h:1920,targetKB:160});}
async function delHl(id){try{await Media.deleteHighlight(id);await refresh();}catch(e){toast('Error: '+e.message);}}

registerView('stories',renderStories);
registerView('highlights',renderHighlights);
