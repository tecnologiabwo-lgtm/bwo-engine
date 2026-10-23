import {esc} from '../utils/format.js';
import {shortDate} from '../utils/dates.js';
/* Visor de historias estilo Instagram. Un solo módulo para panel y cliente. */
const DURATION=5000;
let S=null;
export function openStories(list,start=0,info={}){
  if(!list||!list.length)return;
  closeStories();
  S={list,i:start,elapsed:0,last:0,paused:false,hold:false,pressedAt:0,y0:null,raf:0,info};
  const root=document.createElement('div');
  root.id='sv';root.setAttribute('role','dialog');root.setAttribute('aria-label','Historias');
  root.innerHTML=`<button class="sv-close" aria-label="Cerrar">✕</button>
    <button class="sv-arrow" id="svPrev" aria-label="Anterior">‹</button>
    <div class="sv-stage" id="svStage">
      <div class="sv-bars" id="svBars"></div>
      <div class="sv-head"><div class="sv-av" id="svAv"></div>
        <div class="sv-meta"><b id="svName"></b><span id="svWhen"></span></div>
        <button class="sv-hbtn first" id="svPause" aria-label="Pausar">❚❚</button>
        <button class="sv-hbtn" id="svX" aria-label="Cerrar">✕</button></div>
      <div id="svMedia"></div><div class="sv-foot" id="svFoot"></div>
      <button class="sv-tap l" aria-label="Historia anterior"></button>
      <button class="sv-tap r" aria-label="Siguiente historia"></button>
    </div>
    <button class="sv-arrow" id="svNext" aria-label="Siguiente">›</button>`;
  document.body.appendChild(root);
  const stage=root.querySelector('#svStage');
  root.addEventListener('click',e=>{if(e.target===root)closeStories();});
  root.querySelector('.sv-close').onclick=closeStories;
  root.querySelector('#svX').onclick=closeStories;
  root.querySelector('#svPause').onclick=togglePause;
  root.querySelector('#svPrev').onclick=()=>go(-1);
  root.querySelector('#svNext').onclick=()=>go(1);
  root.querySelector('.sv-tap.l').onclick=()=>tap(-1);
  root.querySelector('.sv-tap.r').onclick=()=>tap(1);
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('.sv-hbtn'))return;S.pressedAt=performance.now();S.hold=true;S.y0=e.clientY;});
  stage.addEventListener('pointermove',e=>{if(!S||S.y0===null)return;const dy=Math.max(0,e.clientY-S.y0);
    stage.style.transform=dy?`translateY(${dy}px) scale(${1-dy/1500})`:'';});
  const release=e=>{if(!S)return;S.hold=false;stage.style.transform='';
    if(S.y0!==null&&e.clientY-S.y0>90){closeStories();return;}S.y0=null;};
  stage.addEventListener('pointerup',release);
  stage.addEventListener('pointercancel',release);
  stage.addEventListener('pointerleave',()=>{if(S){S.hold=false;S.y0=null;stage.style.transform='';}});
  document.addEventListener('keydown',onKey);
  show();S.last=performance.now();S.raf=requestAnimationFrame(tick);
}
function tap(dir){if(!S)return;if(S.pressedAt&&performance.now()-S.pressedAt>260)return;go(dir);}
function togglePause(){if(!S)return;S.paused=!S.paused;
  const b=document.getElementById('svPause');b.textContent=S.paused?'▶':'❚❚';b.setAttribute('aria-label',S.paused?'Reanudar':'Pausar');}
function onKey(e){if(!S)return;
  if(e.key==='ArrowRight')go(1);else if(e.key==='ArrowLeft')go(-1);
  else if(e.key==='Escape')closeStories();else if(e.key===' '){e.preventDefault();togglePause();}}
function show(){
  const s=S.list[S.i],{handle,photo}=S.info;
  document.getElementById('svBars').innerHTML=S.list.map((_,k)=>`<div><i style="width:${k<S.i?100:0}%"></i></div>`).join('');
  const av=document.getElementById('svAv');
  if(photo){av.style.backgroundImage=`url("${photo}")`;av.textContent='';}else{av.style.backgroundImage='';av.textContent='👤';}
  document.getElementById('svName').textContent=handle||'';
  document.getElementById('svWhen').textContent=s.scheduled_date?shortDate(s.scheduled_date):'';
  document.getElementById('svMedia').innerHTML=s.img
    ?`<img class="sv-img" src="${esc(s.img)}" alt="${esc(s.name||'Historia')}">`
    :'<div class="sv-empty">📱</div>';
  document.getElementById('svFoot').innerHTML=
    `<span class="pill">${esc(s.name||'Historia')}</span>
     ${s.scheduled_date?`<span class="pill">📅 ${shortDate(s.scheduled_date)}</span>`:''}
     <span class="pos">${S.i+1}/${S.list.length}</span>`;
  document.getElementById('svPrev').disabled=S.i===0;
  const next=S.list[S.i+1];if(next&&next.img){const im=new Image();im.src=next.img;}
}
function tick(t){
  if(!S)return;
  const dt=t-S.last;S.last=t;
  if(!S.paused&&!S.hold)S.elapsed+=dt;
  const bar=document.querySelectorAll('#svBars i')[S.i];
  if(bar)bar.style.width=Math.min(100,S.elapsed/DURATION*100)+'%';
  if(S.elapsed>=DURATION){go(1);if(!S)return;}
  S.raf=requestAnimationFrame(tick);
}
export function go(dir){
  if(!S)return;
  const next=S.i+dir;
  if(next>=S.list.length){closeStories();return;}
  S.i=Math.max(0,next);S.elapsed=0;show();
}
export function closeStories(){
  if(!S)return;
  cancelAnimationFrame(S.raf);
  document.removeEventListener('keydown',onKey);
  document.getElementById('sv')?.remove();
  S=null;
}
export const viewerState=()=>S;
