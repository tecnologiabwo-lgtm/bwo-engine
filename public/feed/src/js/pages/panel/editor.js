import {state,statusPatch} from './state.js';
import {refresh,toast} from './shell.js';
import {$,$$,setHTML,closeModal} from '../../utils/ui.js';
import {esc,fmtKB} from '../../utils/format.js';
import {FORMATS,STATUS} from '../../config/constants.js';
import {today,stamp} from '../../utils/dates.js';
import {timeline} from '../../templates/timeline.js';
import {pickImage} from '../../utils/imageCompress.js';
import {bindZoom,openZoom} from '../../controllers/zoomView.js';
import * as Posts from '../../services/posts.js';
import * as Events from '../../services/events.js';

let ep=null,imgIdx=0,lastSaved=null,saving=false;
const blank=c=>({id:null,format:'post_v',pillar_id:c.pillars[0]?.id,caption:'',images:[],cover:null,
  scheduled_date:today(),status:'draft',pinned:false,corrections:[],events:[]});

export function openEditor(id){
  const c=state.cc;
  ep=id?structuredClone(c.posts.find(p=>p.id===id)):blank(c);
  ep.images=ep.images||[];imgIdx=0;lastSaved=null;saving=false;
  renderEditor();
}
function mediaBlock(){
  const f=FORMATS[ep.format];
  if(ep.format==='reel'){
    const cv=ep.cover;
    return `<div class="reel-prev">
      <div><p class="rp-lbl">En el reel · 9:16</p><div class="rp-frame r916">${cv?`<img src="${esc(cv)}" alt="Portada del reel">`:'<span>▶<br>Portada<br>1080×1920</span>'}</div></div>
      <div><p class="rp-lbl">En el feed · 3:4</p><div class="rp-frame r34">${cv?`<img src="${esc(cv)}" alt="">`:'<span>▦</span>'}</div>
        <p class="rp-lbl">Pestaña reels</p><div class="rp-frame r916 sm">${cv?`<img src="${esc(cv)}" alt="">`:'<span>▷</span>'}</div></div></div>
      <button class="btn ghost sm block" id="coverBtn">🖼 ${cv?'Cambiar':'Subir'} portada del reel</button>
      <p class="hint">Mantén textos y caras en la franja central: el feed recorta arriba y abajo. El video se sube directo en Instagram; aquí se aprueba la portada.</p>`;
  }
  const cur=ep.images[imgIdx];
  return `<div class="prev-frame">
      ${cur?`<img src="${esc(cur)}" alt="Vista previa" style="aspect-ratio:${f.aspect};object-fit:cover">`
        :`<div class="empty" style="aspect-ratio:${f.aspect}"><span class="big">${f.icon}</span><span>${f.label}</span><span class="px">${f.px}</span></div>`}
      ${ep.images.length>1?`<span class="count">${imgIdx+1}/${ep.images.length}</span>`:''}
      ${cur?'<button class="zoom-open" id="zoomBtn" aria-label="Ampliar imagen">⤢</button>':''}</div>
    ${ep.images.length>1?`<div class="carousel-dots">${ep.images.map((_,i)=>`<span class="cd${i===imgIdx?' on':''}"></span>`).join('')}</div>`:''}
    <div class="thumbs">${ep.images.map((im,i)=>
      `<span class="tw"><img class="t${i===imgIdx?' on':''}" src="${esc(im)}" alt="Lámina ${i+1}" data-pick="${i}">
        <button class="rm" data-rm="${i}" aria-label="Quitar lámina ${i+1}">✕</button></span>`).join('')}
      ${(f.kind==='carousel'||!ep.images.length)?'<button class="add" id="addImg" aria-label="Añadir imagen">＋</button>':''}</div>`;
}
function renderEditor(){
  const c=state.cc,isNew=!ep.id,f=FORMATS[ep.format],st=STATUS[ep.status];
  const lastReq=[...(ep.corrections||[])].reverse().find(x=>x.author==='Cliente'&&!x.resolved);
  setHTML('#modalRoot',`<div class="modal-bg" id="mbg"><div class="modal" role="dialog" aria-label="Editar publicación">
    <header class="modal-h"><b>${isNew?'Nueva publicación':'Editar publicación'}</b>
      <div class="btn-row">${!isNew?`<button class="modal-x" id="archiveBtn" title="Archivar">🗄</button>
        <button class="modal-x danger" id="delBtn" title="Eliminar">🗑</button>`:''}
        <button class="modal-x" id="closeBtn" aria-label="Cerrar">✕</button></div></header>
    <div class="modal-body split">
      <div>${mediaBlock()}
        ${lastSaved?`<p class="compress-note">🗜 Optimizada: ${fmtKB(lastSaved.originalKB)} → <b>${fmtKB(lastSaved.kb)}</b> (${lastSaved.type.split('/')[1].toUpperCase()})</p>`:''}
        ${['draft','changes'].includes(ep.status)?'<button class="btn sm block" id="sendBtn" style="margin-top:12px">📤 Enviar al cliente</button>':''}
        <button class="btn ghost sm block" id="saveBtn" style="margin-top:8px">💾 Guardar${ep.status==='draft'?' como borrador':''}</button>
        ${ep.status==='draft'?'<p class="hint warn center">👁‍🗨 Los borradores no los ve el cliente</p>':''}</div>
      <div>
        <div class="fld"><label>Formato</label><div class="chips">${Object.entries(FORMATS).map(([k,ff])=>
          `<button class="chip${ep.format===k?' on':''}" data-fmt="${k}">${ff.icon} ${ff.label}</button>`).join('')}</div>
          <p class="dim-note">📐 ${f.px} · ${f.ratio}${f.kind==='carousel'?' · misma proporción en todas':''}${ep.format==='reel'?' · la portada se recorta a 3:4 en el feed':''}</p></div>
        <div class="fld"><label>Pilar</label><div class="chips">${c.pillars.map(p=>
          `<button class="chip${ep.pillar_id===p.id?' on':''}" data-pillar="${p.id}" style="${ep.pillar_id===p.id?`background:${p.color}`:''}">${esc(p.name)}</button>`).join('')}</div></div>
        <div class="fld"><label for="edCap">Copy</label><textarea id="edCap" maxlength="2200">${esc(ep.caption)}</textarea></div>
        <div class="row2">
          <div class="fld"><label for="edDate">Fecha estimada de publicación</label><input id="edDate" type="date" value="${esc(ep.scheduled_date||'')}"></div>
          <div class="fld"><label for="edSt">Estado</label><select id="edSt">${Object.entries(STATUS).map(([k,s])=>
            `<option value="${k}"${ep.status===k?' selected':''}>${s.label}</option>`).join('')}</select></div></div>
        <div class="fld"><label class="inline"><input type="checkbox" id="edPin"${ep.pinned?' checked':''}> Fijar arriba 📌</label></div>
        <section class="approval">
          <span class="status-chip" style="background:color-mix(in srgb,${st.color} 15%,transparent);color:${st.color}">${st.ico} ${st.label}</span>
          ${ep.approved_at?`<p class="okbox">✓ <b>Aprobado</b> el ${stamp(ep.approved_at)} por <b>${esc(ep.approved_by||'—')}</b></p>`:''}
          ${lastReq?`<p class="tl-note">↺ ${esc(lastReq.text)}</p>`:''}
          <p class="step-label" style="margin-top:16px">Bitácora</p>${timeline(ep.events||[])}
        </section>
      </div></div></div></div>`);
  bind();
}
function bind(){
  const zoomList=()=>ep.format==='reel'?[ep.cover].filter(Boolean):ep.images;
  bindZoom($('.prev-frame img')||$('.rp-frame img'),zoomList,()=>imgIdx);
  $('#zoomBtn')?.addEventListener('click',()=>openZoom(zoomList(),imgIdx));
  $('#mbg').addEventListener('click',e=>{if(e.target.id==='mbg')closeModal();});
  $('#closeBtn').addEventListener('click',closeModal);
  $('#delBtn')?.addEventListener('click',removePost);
  $('#archiveBtn')?.addEventListener('click',archivePost);
  $('#saveBtn').addEventListener('click',()=>save());
  $('#sendBtn')?.addEventListener('click',sendToClient);
  $('#addImg')?.addEventListener('click',addImage);
  $('#coverBtn')?.addEventListener('click',setCover);
  $$('[data-fmt]').forEach(b=>b.addEventListener('click',()=>{ep.format=b.dataset.fmt;imgIdx=0;renderEditor();}));
  $$('[data-pillar]').forEach(b=>b.addEventListener('click',()=>{ep.pillar_id=b.dataset.pillar;renderEditor();}));
  $$('[data-pick]').forEach(t=>t.addEventListener('click',()=>{imgIdx=+t.dataset.pick;renderEditor();}));
  $$('[data-rm]').forEach(b=>b.addEventListener('click',()=>{
    ep.images.splice(+b.dataset.rm,1);imgIdx=Math.max(0,Math.min(imgIdx,ep.images.length-1));renderEditor();}));
  $('#edCap').addEventListener('input',e=>ep.caption=e.target.value);
  $('#edDate').addEventListener('change',e=>ep.scheduled_date=e.target.value);
  $('#edPin').addEventListener('change',e=>ep.pinned=e.target.checked);
  $('#edSt').addEventListener('change',e=>{ep.status=e.target.value;renderEditor();});
}
const target=()=>{const f=FORMATS[ep.format];return {w:f.w,h:f.h,targetKB:ep.format==='reel'?220:190};};
function addImage(){pickImage(r=>{ep.images.push(r.dataUrl);imgIdx=ep.images.length-1;lastSaved=r;renderEditor();},
  target(),e=>toast('No se pudo procesar la imagen: '+e.message));}
function setCover(){pickImage(r=>{ep.cover=r.dataUrl;lastSaved=r;renderEditor();},
  {w:1080,h:1920,targetKB:220},e=>toast('No se pudo procesar la imagen: '+e.message));}

async function save(msg){
  if(saving)return;
  saving=true;
  $('#saveBtn')?.setAttribute('disabled','');
  $('#sendBtn')?.setAttribute('disabled','');
  const c=state.cc,orig=ep.id?c.posts.find(p=>p.id===ep.id):null;
  const row={client_id:c.id,format:ep.format,pillar_id:ep.pillar_id,caption:ep.caption,images:ep.images,
    cover:ep.cover||null,scheduled_date:ep.scheduled_date||null,status:ep.status,pinned:ep.pinned};
  if(!orig||orig.status!==ep.status)Object.assign(row,statusPatch(ep.status));
  try{
    let id=ep.id;
    if(id){await Posts.updatePost(id,row);}
    else{
      row.sort=c.posts.length;
      id=(await Posts.createPost(row)).id;
      await Events.logEvent(id,'created');
      if(ep.status!=='draft')await Events.logEvent(id,ep.status==='pending'?'sent':ep.status);
    }
    if(orig){
      const mediaChanged=JSON.stringify(orig.images||[])!==JSON.stringify(ep.images)||orig.cover!==ep.cover;
      if(mediaChanged)await Events.logEvent(id,'updated','BigWay','Se cargó una versión nueva del archivo');
      else if(orig.caption!==ep.caption)await Events.logEvent(id,'edited','BigWay','Se editó el copy');
      if(orig.status!==ep.status&&['approved','published','pending'].includes(ep.status))
        await Events.logEvent(id,ep.status==='pending'?'sent':ep.status);
    }
    closeModal();await refresh();toast(msg||'Guardado ✓');
  }catch(e){
    toast('Error al guardar: '+e.message);
    $('#saveBtn')?.removeAttribute('disabled');
    $('#sendBtn')?.removeAttribute('disabled');
  }finally{saving=false;}
}
async function sendToClient(){
  ep.status='pending';
  await save('Enviado al cliente para aprobación ✓');
}
async function removePost(){
  if(!confirm('¿Eliminar publicación? Se pierde también su bitácora.'))return;
  try{await Posts.deletePost(ep.id);closeModal();await refresh();toast('Eliminada');}
  catch(e){toast('Error: '+e.message);}
}
async function archivePost(){
  try{await Posts.updatePost(ep.id,{archived:true});await Events.logEvent(ep.id,'archived');
    closeModal();await refresh();toast('Archivada 🗄');}
  catch(e){toast('Error: '+e.message);}
}
