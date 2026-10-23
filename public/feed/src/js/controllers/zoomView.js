/* Zoom de publicaciones: doble toque, pellizcar y arrastrar.
   Funciona con dedo (pinch), mouse (rueda y doble clic) y teclado (Esc, flechas). */
import {esc} from '../utils/format.js';

const MAX=4,MIN=1,DBL_MS=300,DBL_PX=24;
let Z=null;

export function openZoom(images,index=0,{alt=''}={}){
  const list=(images||[]).filter(Boolean);
  if(!list.length)return;
  closeZoom();
  Z={list,i:Math.max(0,Math.min(index,list.length-1)),scale:1,x:0,y:0,
     pointers:new Map(),lastTap:0,lastXY:null,startDist:0,startScale:1,alt};
  const root=document.createElement('div');
  root.id='zoom';root.setAttribute('role','dialog');root.setAttribute('aria-label','Vista ampliada');
  root.innerHTML=`<button class="zoom-close" aria-label="Cerrar">✕</button>
    <div class="zoom-stage" id="zStage"><img id="zImg" alt="${esc(alt)}" draggable="false"></div>
    <div class="zoom-bar">
      <button class="zoom-btn" id="zPrev" aria-label="Anterior">‹</button>
      <button class="zoom-btn" id="zOut" aria-label="Alejar">−</button>
      <span class="zoom-lvl" id="zLvl">100%</span>
      <button class="zoom-btn" id="zIn" aria-label="Acercar">+</button>
      <button class="zoom-btn" id="zNext" aria-label="Siguiente">›</button>
    </div>
    <p class="zoom-hint">Doble toque o pellizca para ampliar · arrastra para mover</p>`;
  document.body.appendChild(root);
  const stage=root.querySelector('#zStage');
  root.querySelector('.zoom-close').onclick=closeZoom;
  root.querySelector('#zIn').onclick=()=>zoomBy(1.5);
  root.querySelector('#zOut').onclick=()=>zoomBy(1/1.5);
  root.querySelector('#zPrev').onclick=()=>step(-1);
  root.querySelector('#zNext').onclick=()=>step(1);
  root.addEventListener('click',e=>{if(e.target===root)closeZoom();});
  stage.addEventListener('pointerdown',onDown);
  stage.addEventListener('pointermove',onMove,{passive:false});
  stage.addEventListener('pointerup',onUp);
  stage.addEventListener('pointercancel',onUp);
  stage.addEventListener('wheel',onWheel,{passive:false});
  stage.addEventListener('dblclick',e=>toggleAt(e.clientX,e.clientY));
  document.addEventListener('keydown',onKey);
  show();
}
function show(){
  const img=document.getElementById('zImg');
  img.src=Z.list[Z.i];
  document.getElementById('zPrev').disabled=Z.i===0;
  document.getElementById('zNext').disabled=Z.i===Z.list.length-1;
  apply();
}
function apply(){
  const img=document.getElementById('zImg');
  if(!img)return;
  clamp();
  img.style.transform=`translate(${Z.x}px,${Z.y}px) scale(${Z.scale})`;
  img.classList.toggle('grabbing',Z.scale>1);
  document.getElementById('zLvl').textContent=Math.round(Z.scale*100)+'%';
  document.getElementById('zStage').classList.toggle('zoomed',Z.scale>1);
}
/** Impide que la imagen se salga de la pantalla al moverla. */
function clamp(){
  const img=document.getElementById('zImg');if(!img)return;
  if(Z.scale<=1){Z.x=0;Z.y=0;return;}
  const r=img.getBoundingClientRect();
  const w=r.width/Z.scale,h=r.height/Z.scale;
  const maxX=Math.max(0,(w*Z.scale-innerWidth)/2+20);
  const maxY=Math.max(0,(h*Z.scale-innerHeight)/2+20);
  Z.x=Math.max(-maxX,Math.min(maxX,Z.x));
  Z.y=Math.max(-maxY,Math.min(maxY,Z.y));
}
function zoomAround(factor,cx,cy){
  const prev=Z.scale;
  Z.scale=Math.max(MIN,Math.min(MAX,Z.scale*factor));
  const k=Z.scale/prev;
  const dx=cx-innerWidth/2,dy=cy-innerHeight/2;
  Z.x=(Z.x-dx)*k+dx;Z.y=(Z.y-dy)*k+dy;
  if(Z.scale===1){Z.x=0;Z.y=0;}
  apply();
}
const zoomBy=f=>zoomAround(f,innerWidth/2,innerHeight/2);
function toggleAt(cx,cy){Z.scale>1?reset():zoomAround(2.5,cx,cy);}
function reset(){Z.scale=1;Z.x=0;Z.y=0;apply();}
function step(d){
  const n=Z.i+d;if(n<0||n>=Z.list.length)return;
  Z.i=n;reset();show();
}
function onDown(e){
  if(e.target.closest('button'))return;
  Z.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  e.target.setPointerCapture?.(e.pointerId);
  if(Z.pointers.size===2){
    const [a,b]=[...Z.pointers.values()];
    Z.startDist=Math.hypot(a.x-b.x,a.y-b.y);Z.startScale=Z.scale;
  }else{
    const now=Date.now();
    const near=Z.lastXY&&Math.hypot(e.clientX-Z.lastXY.x,e.clientY-Z.lastXY.y)<DBL_PX;
    if(now-Z.lastTap<DBL_MS&&near){toggleAt(e.clientX,e.clientY);Z.lastTap=0;}
    else{Z.lastTap=now;Z.lastXY={x:e.clientX,y:e.clientY};}
    Z.drag={x:e.clientX,y:e.clientY,ox:Z.x,oy:Z.y};
  }
}
function onMove(e){
  if(!Z||!Z.pointers.has(e.pointerId))return;
  Z.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(Z.pointers.size===2){
    e.preventDefault();
    const [a,b]=[...Z.pointers.values()];
    const dist=Math.hypot(a.x-b.x,a.y-b.y);
    if(!Z.startDist)return;
    const prev=Z.scale;
    Z.scale=Math.max(MIN,Math.min(MAX,Z.startScale*(dist/Z.startDist)));
    const k=Z.scale/prev,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    const dx=cx-innerWidth/2,dy=cy-innerHeight/2;
    Z.x=(Z.x-dx)*k+dx;Z.y=(Z.y-dy)*k+dy;
    apply();return;
  }
  if(Z.scale>1&&Z.drag){
    e.preventDefault();
    Z.x=Z.drag.ox+(e.clientX-Z.drag.x);
    Z.y=Z.drag.oy+(e.clientY-Z.drag.y);
    apply();
  }else if(Z.drag&&Math.abs(e.clientY-Z.drag.y)>110&&Math.abs(e.clientX-Z.drag.x)<60){
    closeZoom();
  }
}
function onUp(e){
  if(!Z)return;
  Z.pointers.delete(e.pointerId);
  if(Z.pointers.size<2)Z.startDist=0;
  if(!Z.pointers.size)Z.drag=null;
}
function onWheel(e){
  e.preventDefault();
  zoomAround(e.deltaY<0?1.15:1/1.15,e.clientX,e.clientY);
}
function onKey(e){
  if(!Z)return;
  if(e.key==='Escape')closeZoom();
  else if(e.key==='ArrowRight')step(1);
  else if(e.key==='ArrowLeft')step(-1);
  else if(e.key==='+'||e.key==='=')zoomBy(1.4);
  else if(e.key==='-')zoomBy(1/1.4);
  else if(e.key==='0')reset();
}
export function closeZoom(){
  if(!Z)return;
  document.removeEventListener('keydown',onKey);
  document.getElementById('zoom')?.remove();
  Z=null;
}
export const zoomState=()=>Z;
/** Conecta una imagen (o varias) para abrir el zoom al tocarla dos veces. */
export function bindZoom(el,getImages,getIndex=()=>0){
  if(!el)return;
  let last=0,lastXY=null;
  el.addEventListener('pointerdown',e=>{
    const now=Date.now();
    const near=lastXY&&Math.hypot(e.clientX-lastXY.x,e.clientY-lastXY.y)<DBL_PX;
    if(now-last<DBL_MS&&near){e.preventDefault();openZoom(getImages(),getIndex());last=0;}
    else{last=now;lastXY={x:e.clientX,y:e.clientY};}
  });
  el.addEventListener('dblclick',e=>{e.preventDefault();openZoom(getImages(),getIndex());});
}
