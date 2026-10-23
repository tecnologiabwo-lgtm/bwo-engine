import {state} from './state.js';
import {registerView,reloadAll,toast} from './shell.js';
import {$,$$,setHTML,closeModal} from '../../utils/ui.js';
import {esc} from '../../utils/format.js';
import {DEFAULT_PILLARS,DAYS} from '../../config/constants.js';
import {pickImage} from '../../utils/imageCompress.js';
import * as Clients from '../../services/clients.js';

let w=null,busy=false;
const fresh=()=>({step:0,name:'',handle:'',category:'',bio:'',link:'',photo:null,followers:'0',following:'0',
  pillars:DEFAULT_PILLARS.map(p=>({...p,target_pct:''})),freqWeek:3,freqDays:['Lun','Mié','Vie'],freqNote:''});

export function openWizard(){w=fresh();busy=false;renderWizard();}
function stepBody(){
  if(w.step===0)return `<p class="step-label">Paso 1 de 4 · Datos de la cuenta</p>
    <div class="btn-row" style="align-items:center;margin-bottom:16px">
      <span class="brand-logo lg" id="wPfp">${w.photo?`<img src="${esc(w.photo)}" alt="">`:'👤'}</span>
      <button class="btn ghost sm" id="wPhotoBtn">Subir foto de perfil</button></div>
    <div class="row2"><div class="fld"><label for="wName">Nombre del cliente *</label><input id="wName" value="${esc(w.name)}" maxlength="80"></div>
      <div class="fld"><label for="wHandle">@usuario *</label><input id="wHandle" value="${esc(w.handle)}" maxlength="30"></div></div>
    <div class="fld"><label for="wCat">Categoría (línea bajo el nombre)</label><input id="wCat" value="${esc(w.category)}" maxlength="80" placeholder="Ej. Marketing Digital"></div>
    <div class="fld"><label for="wBio">Bio / descripción</label><textarea id="wBio" maxlength="300">${esc(w.bio)}</textarea></div>
    <div class="row2"><div class="fld"><label for="wLink">Enlace</label><input id="wLink" value="${esc(w.link)}" maxlength="120"></div>
      <div class="fld"><label for="wFoll">Seguidores (visual)</label><input id="wFoll" value="${esc(w.followers)}" maxlength="12"></div></div>`;
  if(w.step===1)return `<p class="step-label">Paso 2 de 4 · Pilares de contenido</p>
    <p class="card-p hint">Define los pilares del cliente y, si quieres, el % objetivo de cada uno.</p>
    <div class="pillar-editor">${w.pillars.map((p,i)=>`<div class="pe">
      <input type="color" value="${p.color}" data-pc="${i}" aria-label="Color del pilar ${i+1}">
      <input type="text" value="${esc(p.name)}" data-pn="${i}" placeholder="Nombre del pilar" maxlength="30">
      <input type="number" value="${esc(p.target_pct)}" data-pt="${i}" placeholder="%" min="0" max="100" aria-label="% objetivo">
      <button data-pd="${i}" aria-label="Quitar pilar">✕</button></div>`).join('')}</div>
    <button class="btn ghost sm" id="addPillar" style="margin-top:10px">＋ Añadir pilar</button>`;
  if(w.step===2)return `<p class="step-label">Paso 3 de 4 · Frecuencia de publicación</p>
    <div class="fld"><label for="wFreq">Publicaciones por semana</label><input id="wFreq" type="number" min="1" max="21" value="${w.freqWeek}"></div>
    <div class="fld"><label>Días sugeridos</label><div class="day-chips">${DAYS.map(d=>
      `<button class="chip${w.freqDays.includes(d)?' on':''}" data-day="${d}">${d}</button>`).join('')}</div></div>
    <div class="fld"><label for="wNote">Nota de cadencia (opcional)</label><input id="wNote" value="${esc(w.freqNote)}" maxlength="120" placeholder="Ej. 2 reels + 1 carrusel por semana"></div>`;
  const names=w.pillars.filter(p=>p.name.trim()).map(p=>p.name).join(', ');
  return `<p class="step-label">Paso 4 de 4 · Confirmar</p>
    <div class="summary">
      <div class="r"><span>Cliente</span><b>${esc(w.name||'—')}</b></div>
      <div class="r"><span>Usuario</span><b>@${esc(w.handle||'—')}</b></div>
      <div class="r"><span>Categoría</span><b>${esc(w.category||'—')}</b></div>
      <div class="r"><span>Pilares</span><b>${esc(names||'—')}</b></div>
      <div class="r"><span>Frecuencia</span><b>${w.freqWeek}/sem · ${esc(w.freqDays.join(', ')||'—')}</b></div>
    </div><p class="hint">Al crear el cliente se genera su link único para revisar y aprobar el feed.</p>`;
}
function renderWizard(){
  setHTML('#modalRoot',`<div class="modal-bg" id="wbg"><div class="modal narrow" role="dialog" aria-label="Nuevo cliente">
    <header class="modal-h"><b>Nuevo cliente</b><button class="modal-x" id="wClose" aria-label="Cerrar">✕</button></header>
    <div class="steps">${[0,1,2,3].map(i=>`<span class="s${i<=w.step?' on':''}"></span>`).join('')}</div>
    <div class="modal-body">${stepBody()}
      <div class="wiz-foot">
        <button class="btn ghost" id="wBack">${w.step===0?'Cancelar':'‹ Atrás'}</button>
        ${w.step<3?'<button class="btn" id="wNext">Siguiente ›</button>':'<button class="btn ok" id="wDone">✓ Crear cliente</button>'}
      </div></div></div></div>`);
  bind();
}
function collect(){
  if(w.step===0){w.name=$('#wName').value.trim();w.handle=$('#wHandle').value.replace(/[^a-z0-9._]/gi,'').toLowerCase();
    w.category=$('#wCat').value.trim();w.bio=$('#wBio').value;w.link=$('#wLink').value.trim();w.followers=$('#wFoll').value.trim();}
  if(w.step===2){w.freqWeek=Math.max(1,Math.min(21,+$('#wFreq').value||1));w.freqNote=$('#wNote').value.trim();}
}
function bind(){
  $('#wbg').addEventListener('click',e=>{if(e.target.id==='wbg')closeModal();});
  $('#wClose').addEventListener('click',closeModal);
  $('#wBack').addEventListener('click',()=>{if(w.step===0){closeModal();return;}collect();w.step--;renderWizard();});
  $('#wNext')?.addEventListener('click',()=>{
    collect();
    if(w.step===0&&!(w.name&&w.handle)){toast('Completa nombre y usuario para continuar');return;}
    w.step++;renderWizard();});
  $('#wDone')?.addEventListener('click',create);
  $('#wPhotoBtn')?.addEventListener('click',()=>pickImage(r=>{w.photo=r.dataUrl;$('#wPfp').innerHTML=`<img src="${r.dataUrl}" alt="">`;},{w:640,h:640,targetKB:90}));
  $('#addPillar')?.addEventListener('click',()=>{collect();w.pillars.push({name:'',color:'#6C3BF5',target_pct:''});renderWizard();});
  $$('[data-pc]').forEach(i=>i.addEventListener('change',()=>w.pillars[+i.dataset.pc].color=i.value));
  $$('[data-pn]').forEach(i=>i.addEventListener('input',()=>w.pillars[+i.dataset.pn].name=i.value));
  $$('[data-pt]').forEach(i=>i.addEventListener('input',()=>w.pillars[+i.dataset.pt].target_pct=i.value));
  $$('[data-pd]').forEach(b=>b.addEventListener('click',()=>{w.pillars.splice(+b.dataset.pd,1);renderWizard();}));
  $$('[data-day]').forEach(b=>b.addEventListener('click',()=>{
    const d=b.dataset.day;collect();
    w.freqDays=w.freqDays.includes(d)?w.freqDays.filter(x=>x!==d):[...w.freqDays,d];renderWizard();}));
}
async function create(){
  if(busy)return;busy=true;
  try{
    const client=await Clients.createClient({name:w.name,handle:w.handle,category:w.category,bio:w.bio,link:w.link,
      photo:w.photo,followers:w.followers,following:w.following,frequency_per_week:w.freqWeek,
      frequency_days:w.freqDays.join(', '),frequency_note:w.freqNote});
    const pillars=w.pillars.filter(p=>p.name.trim())
      .map((p,i)=>({client_id:client.id,name:p.name.trim(),color:p.color,target_pct:p.target_pct?+p.target_pct:null,sort:i}));
    if(pillars.length)await Clients.addPillars(pillars);
    closeModal();state.view='feed';await reloadAll(client.id);toast('Cliente creado ✓');
  }catch(e){toast('Error al crear cliente: '+e.message);}
  finally{busy=false;}
}
registerView('wizard',openWizard);
