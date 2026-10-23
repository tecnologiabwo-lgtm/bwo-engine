export const $=(s,root=document)=>root.querySelector(s);
export const $$=(s,root=document)=>[...root.querySelectorAll(s)];
let toastTimer;
export function toast(msg){
  const el=$('#toast');if(!el)return;
  el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);
}
export const setHTML=(sel,html)=>{const el=$(sel);if(el)el.innerHTML=html;};
export const closeModal=()=>setHTML('#modalRoot','');
/** Estados obligatorios de datos: carga / vacío / error */
export const loadingState=(msg='Cargando…')=>`<div class="loader">${msg}</div>`;
export const emptyState=(icon,msg,action='')=>`<div class="state"><span class="icon">${icon}</span>${msg}${action}</div>`;
export const errorState=(msg,retryFn)=>`<div class="state error"><span class="icon">⚠️</span>${msg}
  <div><button class="btn ghost" onclick="${retryFn}">Reintentar</button></div></div>`;
