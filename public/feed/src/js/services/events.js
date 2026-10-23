import {sb,run,runAll,inChunks} from './db.js';
/** Bitácora de cada publicación: quién hizo qué y cuándo. Se lee completa (por páginas y lotes de ids). */
const byPosts=(table,postIds)=>postIds.length
  ? inChunks(postIds,ids=>runAll(()=>sb.from(table).select('*').in('post_id',ids).order('created_at')))
      .then(rows=>rows.sort((a,b)=>a.created_at.localeCompare(b.created_at)))
  : Promise.resolve([]);
export const listEvents=postIds=>byPosts('post_events',postIds);
export const listCorrections=postIds=>byPosts('corrections',postIds);
export const logEvent=(postId,type,actor='BigWay',note=null)=>
  run(sb.from('post_events').insert({post_id:postId,type,actor,note}));
export const logEvents=(postIds,type,actor='BigWay',note=null)=>
  run(sb.from('post_events').insert(postIds.map(id=>({post_id:id,type,actor,note}))));
