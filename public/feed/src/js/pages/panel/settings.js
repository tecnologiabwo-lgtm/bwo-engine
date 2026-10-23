import {state,pillarOf,loadClient} from './state.js';
import {registerView,refresh,renderNav,renderClientSel,reloadAll,setView,toast} from './shell.js';
import {$,$$,setHTML,loadingState} from '../../utils/ui.js';
import {esc,dataUrlKB,fmtKB} from '../../utils/format.js';
import {FORMATS,STATUS} from '../../config/constants.js';
import {today,shortDate,stamp,shortStamp} from '../../utils/dates.js';
import {thumbOf} from '../../templates/gridCell.js';
import {EVENTS} from '../../config/constants.js';
import {pickImage} from '../../utils/imageCompress.js';
import * as Clients from '../../services/clients.js';
import * as Posts from '../../services/posts.js';
import * as Events from '../../services/events.js';

const sizeOf=p=>(p.images||[]).reduce((s,i)=>s+dataUrlKB(i),0)+dataUrlKB(p.cover);

/* ---------- Archivo ---------- */
async function renderArchive(){
  setHTML('#main',loadingState('Cargando archivo…'));
  try{
    const A=await Posts.listArchived(state.cc.id);
    state.archive=A;
    const kb=A.reduce((s,p)=>s+sizeOf(p),0);
    setHTML('#main',`<header class="page-head">
        <div><h1>Archivo</h1><p>${A.length} publicaciones archivadas · no se cargan en el feed ni en el link del cliente · ocupan ≈ ${fmtKB(kb)}</p></div>
        ${A.some(p=>(p.images||[]).length||p.cover)?'<button class="btn ghost" id="purge">🧹 Liberar espacio</button>':''}</header>
      ${A.length?`<div class="arch-list">${A.map(p=>{
        const f=FORMATS[p.format]||FORMATS.post_v,src=thumbOf(p);
        return `<div class="arch-row"><span class="arch-th">${src?`<img src="${esc(src)}" alt="">`:f.icon}</span>
          <span class="tt"><b>${f.icon} ${esc(p.caption||f.label)}</b>
            <span class="arch-meta">📅 ${shortDate(p.scheduled_date)||'—'} · ${(STATUS[p.status]||STATUS.draft).label}${
              p.approved_at?` · ✓ aprobado ${shortStamp(p.approved_at)} por ${esc(p.approved_by||'')}`:''} · ${fmtKB(sizeOf(p))}</span></span>
          <button class="btn ghost sm" data-restore="${p.id}">↩ Restaurar</button></div>`;}).join('')}</div>`
      :'<div class="state"><span class="icon">🗄</span>No hay publicaciones archivadas.</div>'}`);
    $('#purge')?.addEventListener('click',purge);
    $$('[data-restore]').forEach(b=>b.addEventListener('click',()=>restore(b.dataset.restore)));
  }catch(e){
    setHTML('#main',`<div class="state error"><span class="icon">⚠️</span>No pudimos cargar el archivo: ${esc(e.message)}
      <div><button class="btn ghost" id="retry">Reintentar</button></div></div>`);
    $('#retry').addEventListener('click',renderArchive);
  }
}
async function restore(id){
  try{await Posts.updatePost(id,{archived:false});await Events.logEvent(id,'restored');
    state.cc=await loadClient(state.cc.id);renderNav();renderArchive();toast('Restaurada al feed ✓');}
  catch(e){toast('Error: '+e.message);}
}
async function purge(){
  if(!confirm('Se borrarán las IMÁGENES de las publicaciones archivadas para liberar espacio. Se conservan copy, fechas y bitácora. ¿Continuar?'))return;
  const ids=(state.archive||[]).map(p=>p.id);if(!ids.length)return;
  try{await Posts.updatePosts(ids,{images:[],cover:null});renderArchive();toast('Espacio liberado ✓');}
  catch(e){toast('Error: '+e.message);}
}

/* ---------- Respaldo CSV ---------- */
export async function exportApprovals(){
  const c=state.cc;
  try{
    const P=await Posts.listAllPosts(c.id);
    const ids=P.map(p=>p.id);
    const ev=await Events.listEvents(ids);
    const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
    const rows=[['Fecha estimada','Formato','Pilar','Copy','Estado','Aprobado el','Aprobado por','Archivada','Bitácora completa']];
    P.forEach(p=>rows.push([p.scheduled_date||'',(FORMATS[p.format]||{}).label||p.format,pillarOf(c,p.pillar_id).name,
      p.caption||'',(STATUS[p.status]||{}).label||p.status,p.approved_at?stamp(p.approved_at):'',p.approved_by||'',p.archived?'Sí':'No',
      ev.filter(e=>e.post_id===p.id).map(e=>`[${shortStamp(e.created_at)}] ${(EVENTS[e.type]||{label:e.type}).label} · ${e.actor}${e.note?': '+e.note:''}`).join(' | ')]));
    const csv='\ufeff'+rows.map(r=>r.map(q).join(';')).join('\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.download=`bitacora-${c.handle}-${today()}.csv`;
    document.body.appendChild(a);a.click();a.remove();
    toast('Registro exportado ✓');
  }catch(e){toast('Error al exportar: '+e.message);}
}

/* ---------- Cuenta ---------- */
function renderAccount(){
  const c=state.cc;
  const used=c.posts.reduce((s,p)=>s+sizeOf(p),0)+c.stories.reduce((s,x)=>s+dataUrlKB(x.img),0);
  setHTML('#main',`<header class="page-head"><div><h1>Cuenta del cliente</h1><p>Datos, pilares, frecuencia y espacio</p></div></header>
    <div class="acct" style="max-width:560px">
      <section class="card">
        <div class="btn-row" style="align-items:center;margin-bottom:16px">
          <span class="brand-logo lg">${c.photo?`<img src="${esc(c.photo)}" alt="">`:'👤'}</span>
          <button class="btn ghost sm" id="pfpBtn">Cambiar foto</button></div>
        <div class="row2"><div class="fld"><label for="aName">Nombre</label><input id="aName" value="${esc(c.name)}" data-f="name"></div>
          <div class="fld"><label for="aHandle">@usuario</label><input id="aHandle" value="${esc(c.handle)}" data-f="handle"></div></div>
        <div class="fld"><label for="aCat">Categoría</label><input id="aCat" value="${esc(c.category||'')}" data-f="category"></div>
        <div class="fld"><label for="aBio">Bio</label><textarea id="aBio" data-f="bio">${esc(c.bio||'')}</textarea></div>
        <div class="row2"><div class="fld"><label for="aLink">Enlace</label><input id="aLink" value="${esc(c.link||'')}" data-f="link"></div>
          <div class="fld"><label for="aFoll">Seguidores</label><input id="aFoll" value="${esc(c.followers||'')}" data-f="followers"></div></div>
        <div class="row2"><div class="fld"><label for="aFreq">Publicaciones/semana</label><input id="aFreq" type="number" min="1" max="21" value="${esc(c.frequency_per_week||3)}" data-f="frequency_per_week" data-num="1"></div>
          <div class="fld"><label for="aDays">Días</label><input id="aDays" value="${esc(c.frequency_days||'')}" data-f="frequency_days"></div></div>
      </section>
      <section class="card"><h3>🎨 Pilares</h3><div class="pillar-editor">${c.pillars.map(p=>`<div class="pe">
          <input type="color" value="${p.color}" data-pc="${p.id}" aria-label="Color de ${esc(p.name)}">
          <input type="text" value="${esc(p.name)}" data-pn="${p.id}">
          <button data-pd="${p.id}" aria-label="Eliminar pilar">✕</button></div>`).join('')}</div>
        <button class="btn ghost sm" id="addPillar" style="margin-top:10px">＋ Añadir pilar</button></section>
      <section class="card"><h3>💾 Espacio y archivo</h3>
        <p>Contenido activo de este cliente: <b>${fmtKB(used)}</b> <span class="hint">(el plan gratuito de Supabase da 500 MB entre todos los clientes)</span></p>
        <div class="fld" style="margin-top:12px"><label for="aArch">Archivar automáticamente publicadas con más de</label>
          <select id="aArch" data-f="archive_after_days" data-num="1">${[['','Nunca'],[30,'30 días'],[60,'60 días'],[90,'90 días'],[180,'6 meses']].map(([v,l])=>
            `<option value="${v}"${String(c.archive_after_days||'')===String(v)?' selected':''}>${l}</option>`).join('')}</select></div>
        <div class="btn-row"><button class="btn ghost sm" id="goArchive">🗄 Ver archivo</button>
          <button class="btn ghost sm" id="exportBtn">⬇ Exportar bitácora (CSV)</button></div></section>
      <section class="card"><button class="btn ghost sm" id="delClient" style="color:var(--danger)">🗑 Eliminar cliente</button></section>
    </div>`);
  $$('[data-f]').forEach(i=>i.addEventListener('change',()=>{
    let v=i.value;
    if(i.dataset.f==='handle')v=v.replace(/[^a-z0-9._]/gi,'').toLowerCase();
    if(i.dataset.num)v=v===''?null:+v;
    save(i.dataset.f,v);}));
  $('#pfpBtn').addEventListener('click',()=>pickImage(async r=>{
    try{await Clients.updateClient(state.cc.id,{photo:r.dataUrl});await refresh();}catch(e){toast('Error: '+e.message);}},{w:640,h:640,targetKB:90}));
  $$('[data-pc]').forEach(i=>i.addEventListener('change',()=>savePillar(i.dataset.pc,{color:i.value})));
  $$('[data-pn]').forEach(i=>i.addEventListener('change',()=>savePillar(i.dataset.pn,{name:i.value})));
  $$('[data-pd]').forEach(b=>b.addEventListener('click',()=>delPillar(b.dataset.pd)));
  $('#addPillar').addEventListener('click',addPillar);
  $('#goArchive').addEventListener('click',()=>setView('archive'));
  $('#exportBtn').addEventListener('click',exportApprovals);
  $('#delClient').addEventListener('click',delClient);
}
async function save(field,value){
  try{await Clients.updateClient(state.cc.id,{[field]:value});state.cc[field]=value;renderClientSel();toast('Guardado ✓');}
  catch(e){toast('Error: '+e.message);}
}
async function savePillar(id,patch){try{await Clients.updatePillar(id,patch);state.cc=await loadClient(state.cc.id);}catch(e){toast('Error: '+e.message);}}
async function addPillar(){try{await Clients.addPillars([{client_id:state.cc.id,name:'Nuevo pilar',color:'#6C3BF5',sort:state.cc.pillars.length}]);await refresh();}catch(e){toast('Error: '+e.message);}}
async function delPillar(id){if(!confirm('¿Eliminar pilar?'))return;
  try{await Clients.deletePillar(id);await refresh();}catch(e){toast('Error: '+e.message);}}
async function delClient(){
  if(!confirm('¿Eliminar cliente y todo su contenido? No se puede deshacer.'))return;
  try{await Clients.deleteClient(state.cc.id);state.view='feed';await reloadAll(null);toast('Cliente eliminado');}
  catch(e){toast('Error: '+e.message);}
}
registerView('archive',renderArchive);
registerView('account',renderAccount);
