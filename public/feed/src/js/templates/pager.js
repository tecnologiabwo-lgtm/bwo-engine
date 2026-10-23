/* Cuadrícula limitada a 6 filas × 3 columnas (18 publicaciones por vista)
   para no saturar la pantalla. El resto se recorre con el paginador. */
export const ROWS=6,COLS=3,PAGE_CELLS=ROWS*COLS;
export function paginate(list,page){
  const pages=Math.max(1,Math.ceil(list.length/PAGE_CELLS));
  const p=Math.min(Math.max(0,page|0),pages-1);
  return {items:list.slice(p*PAGE_CELLS,(p+1)*PAGE_CELLS),page:p,pages,offset:p*PAGE_CELLS,total:list.length};
}
/** onGo: nombre de la función global que recibe el número de página (p. ej. 'window.P.page'). */
export function pagerHTML({page,pages,offset,total,items},onGo){
  if(pages<=1)return '';
  const from=offset+1,to=offset+items.length;
  return `<nav class="ig-pager" aria-label="Páginas del feed">
    <button class="pg" ${page===0?'disabled':''} onclick="${onGo}(${page-1})" aria-label="Página anterior">‹</button>
    <span>${from}–${to} de ${total} · página ${page+1}/${pages}</span>
    <button class="pg" ${page>=pages-1?'disabled':''} onclick="${onGo}(${page+1})" aria-label="Página siguiente">›</button></nav>`;
}
