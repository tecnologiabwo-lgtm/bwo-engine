/* Reordenar arrastrando, como en Instagram:
   mantener presionado para levantar, la miniatura sigue el dedo,
   las demás se reacomodan con animación y al soltar se guarda el orden.
   Usa Pointer Events: funciona igual con mouse, dedo y lápiz. */
const HOLD_MS=180;      // tiempo para "levantar"
const CANCEL_PX=10;     // si se mueve antes, es scroll o clic
const EDGE=70;          // franja de autoscroll
const SPEED=14;

export function createSortable(grid,{itemSelector='[data-sortable]',onEnd,onLift}={}){
  if(!grid)return ()=>{};
  let st=null;

  const items=()=>[...grid.querySelectorAll(itemSelector)];
  const rects=()=>new Map(items().map(el=>[el,el.getBoundingClientRect()]));

  /* FLIP: anima cada celda desde donde estaba hasta donde quedó */
  function animate(before){
    items().forEach(el=>{
      const a=before.get(el);if(!a)return;
      const b=el.getBoundingClientRect();
      const dx=a.left-b.left,dy=a.top-b.top;
      if(!dx&&!dy)return;
      el.style.transition='none';
      el.style.transform=`translate(${dx}px,${dy}px)`;
      requestAnimationFrame(()=>{el.classList.add('shifting');el.style.transform='';});
    });
  }
  const clean=()=>items().forEach(el=>{el.classList.remove('shifting');el.style.transition='';el.style.transform='';});

  function lift(e,el){
    const r=el.getBoundingClientRect();
    const ghost=el.cloneNode(true);
    ghost.className='drag-ghost';
    Object.assign(ghost.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    document.body.appendChild(ghost);
    requestAnimationFrame(()=>ghost.style.transform='scale(1.06)');
    el.classList.add('lifted');grid.classList.add('sorting');
    navigator.vibrate?.(12);
    st.ghost=ghost;st.active=true;st.ox=e.clientX-r.left;st.oy=e.clientY-r.top;
    onLift?.(el);
  }
  function moveGhost(e){
    st.ghost.style.left=(e.clientX-st.ox)+'px';
    st.ghost.style.top=(e.clientY-st.oy)+'px';
  }
  function autoScroll(e){
    const y=e.clientY;
    if(y<EDGE)scrollBy(0,-SPEED);
    else if(y>innerHeight-EDGE)scrollBy(0,SPEED);
  }
  function overCell(e){
    st.ghost.style.pointerEvents='none';
    const el=document.elementFromPoint(e.clientX,e.clientY);
    return el&&el.closest?el.closest(itemSelector):null;
  }

  function onDown(e){
    const el=e.target.closest?.(itemSelector);
    if(!el||e.button>0)return;
    st={el,x0:e.clientX,y0:e.clientY,active:false,ghost:null,
        timer:setTimeout(()=>{if(st)lift(e,el);},HOLD_MS)};
    grid.setPointerCapture?.(e.pointerId);
  }
  function onMove(e){
    if(!st)return;
    if(!st.active){
      if(Math.hypot(e.clientX-st.x0,e.clientY-st.y0)>CANCEL_PX)abort();
      return;
    }
    e.preventDefault();
    moveGhost(e);autoScroll(e);
    const target=overCell(e);
    if(!target||target===st.el)return;
    const before=rects();
    const list=items();
    const from=list.indexOf(st.el),to=list.indexOf(target);
    if(from<0||to<0)return;
    target.parentNode.insertBefore(st.el,from<to?target.nextSibling:target);
    animate(before);
  }
  function finish(){
    if(!st)return;
    clearTimeout(st.timer);
    if(st.active){
      st.ghost?.remove();
      st.el.classList.remove('lifted');
      grid.classList.remove('sorting');
      clean();
      onEnd?.(items().map(el=>el.dataset.id));
    }
    st=null;
  }
  function abort(){
    if(!st)return;
    clearTimeout(st.timer);
    if(st.active){st.ghost?.remove();st.el.classList.remove('lifted');grid.classList.remove('sorting');clean();}
    st=null;
  }
  /** Un clic normal no debe abrirse si acabamos de arrastrar. */
  function onClickCapture(e){
    if(grid.dataset.justSorted==='1'){e.stopPropagation();e.preventDefault();grid.dataset.justSorted='0';}
  }
  const onUp=()=>{const wasActive=st?.active;finish();if(wasActive){grid.dataset.justSorted='1';setTimeout(()=>grid.dataset.justSorted='0',300);}};

  grid.addEventListener('pointerdown',onDown);
  grid.addEventListener('pointermove',onMove,{passive:false});
  grid.addEventListener('pointerup',onUp);
  grid.addEventListener('pointercancel',abort);
  grid.addEventListener('click',onClickCapture,true);
  return ()=>{abort();
    grid.removeEventListener('pointerdown',onDown);
    grid.removeEventListener('pointermove',onMove);
    grid.removeEventListener('pointerup',onUp);
    grid.removeEventListener('pointercancel',abort);
    grid.removeEventListener('click',onClickCapture,true);};
}
