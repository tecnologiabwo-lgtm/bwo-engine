import {state,loadClient,loadClients} from './state.js';
import {BRAND} from '../../config/env.js';
import {$,setHTML,toast,loadingState,errorState} from '../../utils/ui.js';
import {esc} from '../../utils/format.js';
import * as Auth from '../../services/auth.js';

const NAV=[['feed','🔲','Feed & Perfil'],['stories','📱','Historias'],['highlights','⭕','Destacadas'],
  ['calendar','🗓','Calendario'],['analytics','📊','Analítica'],['timeline','🕒','Bitácora'],
  ['archive','🗄','Archivo'],['account','⚙️','Cuenta']];
const views={};
export const registerView=(name,fn)=>{views[name]=fn;};
export const logo=(cls='')=>BRAND.logo
  ?`<span class="brand-logo ${cls}"><img src="${BRAND.logo}" alt="${esc(BRAND.owner)}"></span>`
  :`<span class="brand-logo ${cls}">${esc(BRAND.initials)}</span>`;

export function renderLogin(msg=''){
  document.documentElement.setAttribute('data-theme','dark');
  setHTML('#root',`<main class="login"><form class="box" id="loginForm">
    ${logo('lg')}<h1>${esc(BRAND.name)}</h1><p>Panel de la agencia · ${esc(BRAND.owner)}</p>
    <label class="sr-only" for="email">Correo</label><input id="email" type="email" placeholder="Correo" autocomplete="email">
    <label class="sr-only" for="pass">Contraseña</label><input id="pass" type="password" placeholder="Contraseña" autocomplete="current-password">
    <p class="err" id="loginErr">${esc(msg)}</p>
    <button class="btn block" type="submit">Entrar</button>
  </form></main>`);
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    try{await Auth.signIn($('#email').value.trim(),$('#pass').value);await boot();}
    catch{ $('#loginErr').textContent='Correo o contraseña incorrectos';}
  });
}
export function renderShell(){
  document.documentElement.setAttribute('data-theme',state.theme);
  setHTML('#root',`<div class="app">
    <aside class="side">
      <div class="brand-mark">${logo()}<span><b class="brand-name">${esc(BRAND.name)}</b><small class="brand-sub">${esc(BRAND.owner)}</small></span></div>
      <div class="client-pick"><label for="clientSel">Cliente</label><select id="clientSel"></select></div>
      <nav class="nav" id="nav" aria-label="Secciones"></nav>
      <div class="side-foot">
        <button id="themeBtn" aria-label="Cambiar tema">🌙</button>
        <button id="logoutBtn">Salir</button>
      </div>
    </aside>
    <main class="main" id="main"></main></div>`);
  $('#clientSel').addEventListener('change',e=>selectClient(e.target.value));
  $('#themeBtn').addEventListener('click',toggleTheme);
  $('#logoutBtn').addEventListener('click',()=>Auth.signOut().then(()=>location.reload()));
  renderNav();renderClientSel();render();
}
export function renderNav(){
  const pend=state.cc?state.cc.posts.filter(p=>p.status==='pending').length:0;
  setHTML('#nav',NAV.map(([k,ic,label])=>
    `<button data-view="${k}" ${state.view===k?'aria-current="page"':''}><span class="ic" aria-hidden="true">${ic}</span>${label}${(k==='feed'&&pend)?`<span class="badge">${pend}</span>`:''}</button>`).join(''));
  $('#nav').querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
}
export function renderClientSel(){
  const sel=$('#clientSel');if(!sel)return;
  sel.innerHTML=state.clients.map(c=>`<option value="${c.id}"${c.id===state.cc?.id?' selected':''}>${esc(c.name)}</option>`).join('')
    +'<option value="__new">➕ Nuevo cliente…</option>';
}
export function setView(v){state.view=v;state.selMode=false;state.selected.clear();renderNav();render();}
function toggleTheme(){
  state.theme=state.theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',state.theme);
  $('#themeBtn').textContent=state.theme==='dark'?'🌙':'☀️';
}
export function render(){
  if(!state.cc){
    setHTML('#main',`<div class="state"><span class="icon">📲</span>No hay clientes todavía.
      <div><button class="btn" id="firstClient">＋ Crear primer cliente</button></div></div>`);
    $('#firstClient')?.addEventListener('click',()=>views.wizard());
    return;
  }
  (views[state.view]||views.feed)();
}
export async function selectClient(id){
  if(id==='__new'){renderClientSel();views.wizard();return;}
  state.feedTab='grid';state.feedPage=0;state.selMode=false;state.selected.clear();
  state.cc=await loadClient(id);renderNav();render();
}
export async function refresh(){
  state.cc=await loadClient(state.cc.id);renderNav();render();
}
export async function reloadAll(focusId){
  state.clients=await loadClients();
  const exists=id=>!!id&&state.clients.some(c=>c.id===id);
  const id=exists(focusId)?focusId:(exists(state.cc?.id)?state.cc.id:state.clients[0]?.id);
  state.cc=id?await loadClient(id):null;
  renderShell();
}
export async function boot(){
  setHTML('#root',loadingState('Cargando tu espacio…'));
  try{
    if(!await Auth.getSession()){renderLogin();return;}
    state.clients=await loadClients();
    state.cc=state.clients.length?await loadClient(state.clients[0].id):null;
    renderShell();
  }catch(e){
    setHTML('#root',errorState(`No pudimos conectar: ${esc(e.message)}`,''));
    document.querySelector('.state .btn')?.addEventListener('click',boot);
  }
}
export {toast};
