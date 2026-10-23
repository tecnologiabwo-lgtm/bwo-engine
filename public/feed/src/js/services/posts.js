import {sb,run,runAll} from './db.js';
const base=()=>sb.from('posts').select('*');
export const listPosts=clientId=>runAll(()=>base().eq('client_id',clientId).eq('archived',false)
  .order('pinned',{ascending:false}).order('sort'));
export const listArchived=clientId=>runAll(()=>base().eq('client_id',clientId).eq('archived',true)
  .order('scheduled_date',{ascending:false}));
export const listAllPosts=clientId=>runAll(()=>base().eq('client_id',clientId).order('scheduled_date'));
export const createPost=row=>run(sb.from('posts').insert(row).select().single());
export const updatePost=(id,patch)=>run(sb.from('posts').update(patch).eq('id',id));
export const updatePosts=(ids,patch)=>run(sb.from('posts').update(patch).in('id',ids));
export const deletePost=id=>run(sb.from('posts').delete().eq('id',id));
/** Solo guarda las publicaciones cuyo orden cambió (antes: una petición por cada post). */
export const setOrder=(pairs,current=new Map())=>Promise.all(pairs.filter(([id,sort])=>current.get(id)!==sort).map(([id,sort])=>updatePost(id,{sort})));
export const sendDrafts=clientId=>run(sb.from('posts').update({status:'pending'})
  .eq('client_id',clientId).eq('status','draft').eq('archived',false));
