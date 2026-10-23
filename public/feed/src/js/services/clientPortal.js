import {sb} from '../config/supabase.js';
/** Único punto de contacto de la vista pública: siempre por función con token. */
async function rpc(fn,args){
  const {data,error}=await sb.rpc(fn,args);
  if(error)throw new Error(error.message||'Error de conexión');
  return data;
}
export const fetchFeed      =token=>rpc('get_client_feed',{p_token:token});
export const approvePosts   =(token,ids)=>rpc('client_bulk_approve',{p_token:token,p_posts:ids});
export const requestChanges =(token,ids,text)=>rpc('client_bulk_changes',{p_token:token,p_posts:ids,p_text:text});
