import {esc,clip} from '../utils/format.js';
import {FORMATS,STATUS} from '../config/constants.js';
import {shortDate} from '../utils/dates.js';
export const thumbOf=p=>(p.format==='reel'&&p.cover)?p.cover:(p.images||[])[0]||p.cover||'';
/** Celda de la cuadrícula, igual en el panel y en la vista del cliente. */
export function gridCell(post,{pillar,reelTab=false,selectable=false,selected=false,locked=false,onClick='',draggable=false}={}){
  const f=FORMATS[post.format]||FORMATS.post_v;
  const st=STATUS[post.status]||STATUS.draft;
  const src=thumbOf(post);
  const fmtIcon=post.format==='carousel'?'▤':post.format==='reel'?'▶':'';
  return `<button type="button" class="ig-cell${reelTab?' reel':''}${selected?' sel':''}${locked?' locked':''}"
    ${draggable?'data-sortable="1"':''} data-id="${esc(post.id)}" onclick="${onClick}"
    aria-label="${esc(clip(post.caption||f.label,60))} · ${st.label}">
    ${src?`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`:`<span class="ph">${esc(clip(post.caption||'Sin imagen',40))}</span>`}
    ${post.pinned?'<span class="pin" aria-hidden="true">📌</span>':''}
    ${fmtIcon&&!reelTab?`<span class="fmt" aria-hidden="true">${fmtIcon}</span>`:''}
    <span class="sbadge" style="background:${st.color}" title="${st.label}">${st.ico}</span>
    ${post.scheduled_date?`<span class="dchip">${shortDate(post.scheduled_date)}</span>`:''}
    <span class="pdot" style="background:${pillar?pillar.color:'var(--text-faint)'}"></span>
    ${selectable?`<span class="chk"><i>${selected?'✓':''}</i></span>`:''}
  </button>`;
}
export const emptyCells=(count,reelTab=false)=>count>0
  ? Array(count).fill(0).map(()=>`<div class="ig-cell${reelTab?' reel':''}"><span class="ph">＋</span></div>`).join('') : '';
