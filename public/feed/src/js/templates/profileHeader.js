import {esc} from '../utils/format.js';
/** Cabecera del perfil de Instagram. Solo recibe datos y devuelve HTML. */
export function profileHeader(client,{postCount,stories=[],highlights=[],onStories='',tab='grid',onTab=''}={}){
  const pfp=client.photo
    ? `<img class="ig-pfp" src="${esc(client.photo)}" alt="Foto de perfil de ${esc(client.name)}">`
    : `<div class="ig-pfp empty" role="img" aria-label="Sin foto de perfil">👤</div>`;
  const avatar=stories.length&&onStories
    ? `<button class="story-ring" onclick="${onStories}" aria-label="Ver historias">${pfp}</button>`
    : pfp;
  const hl=highlights.map(h=>`<div class="hl"><div class="c">${h.cover?`<img src="${esc(h.cover)}" alt="">`:'＋'}</div><span>${esc(h.name)}</span></div>`).join('');
  return `<div class="ig-top"><span class="handle">@${esc(client.handle)} ▾</span><span aria-hidden="true">＋ ≡</span></div>
  <div class="ig-prof">
    <div class="ig-row">${avatar}
      <div class="ig-stats">
        <div><b>${postCount}</b><span>pub.</span></div>
        <div><b>${esc(client.followers||'0')}</b><span>seguidores</span></div>
        <div><b>${esc(client.following||'0')}</b><span>seguidos</span></div>
      </div>
    </div>
    <div class="ig-bio">
      <div class="nm">${esc(client.name)}</div>
      ${client.category?`<div class="cat">${esc(client.category)}</div>`:''}
      ${client.bio?`<div>${esc(client.bio).replace(/\n/g,'<br>')}</div>`:''}
      ${client.link?`<div class="lk">🔗 ${esc(client.link)}</div>`:''}
    </div>
  </div>
  ${highlights.length?`<div class="ig-hl">${hl}</div>`:''}
  <div class="ig-tabs" role="tablist">
    <button role="tab" aria-selected="${tab==='grid'}" aria-label="Cuadrícula" onclick="${onTab}('grid')">▦</button>
    <button role="tab" aria-selected="${tab==='reels'}" aria-label="Reels" onclick="${onTab}('reels')">▷</button>
    <button role="tab" aria-selected="false" aria-label="Etiquetadas">👤</button>
  </div>`;
}
