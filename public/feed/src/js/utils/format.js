export const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
export const attr=s=>esc(s).replace(/'/g,'&#39;');
export const clip=(s,n)=>{const t=String(s??'');return t.length>n?t.slice(0,n)+'…':t;};
/** Peso aproximado en KB de una cadena data-URL (base64 = 4/3 del binario). */
export const dataUrlKB=s=>s?s.length*0.75/1024:0;
export const fmtKB=kb=>kb>=1024?(kb/1024).toFixed(1)+' MB':Math.round(kb)+' KB';
export const pct=(n,total)=>total?Math.round(n/total*100):0;
