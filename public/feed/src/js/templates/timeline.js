import {esc} from '../utils/format.js';
import {EVENTS} from '../config/constants.js';
import {shortStamp} from '../utils/dates.js';
/** Bitácora de una publicación: qué pasó, quién y a qué hora. */
export function timeline(events){
  if(!events.length)return '<p class="tl-empty">Sin movimientos registrados todavía.</p>';
  return `<ol class="timeline">${events.map(ev=>{
    const meta=EVENTS[ev.type]||{label:ev.type,ico:'•',color:'var(--text-faint)'};
    return `<li class="tl-item">
      <span class="tl-dot" style="background:${meta.color}" aria-hidden="true">${meta.ico}</span>
      <div class="tl-head"><span class="tl-title">${meta.label}</span>
        <span class="tl-who">· ${esc(ev.actor||'—')}</span>
        <time class="tl-when" datetime="${esc(ev.created_at)}">${shortStamp(ev.created_at)}</time></div>
      ${ev.note?`<p class="tl-note">${esc(ev.note)}</p>`:''}
    </li>`;}).join('')}</ol>`;
}
