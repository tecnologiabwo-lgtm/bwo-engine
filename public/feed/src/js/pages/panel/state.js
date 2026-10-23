import * as Clients from '../../services/clients.js';
import * as Posts from '../../services/posts.js';
import * as Media from '../../services/media.js';
import * as Events from '../../services/events.js';
import {daysAgo} from '../../utils/dates.js';

export const state={clients:[],cc:null,view:'feed',theme:'dark',archive:[],
  calMonth:new Date().getFullYear()*12+new Date().getMonth(),
  feedTab:'grid',selMode:false,selected:new Set(),error:null};

export const statusPatch=s=>{
  const patch={status:s};
  if(s==='approved'){patch.approved_at=new Date().toISOString();patch.approved_by='BigWay';}
  else if(s!=='published'){patch.approved_at=null;patch.approved_by=null;}
  return patch;
};
export const pillarOf=(c,id)=>(c.pillars||[]).find(p=>p.id===id)||{name:'—',color:'var(--text-faint)'};
export const sortedPosts=c=>[...c.posts].sort((a,b)=>(b.pinned-a.pinned)||(a.sort-b.sort));

/** Archiva lo publicado que superó la antigüedad configurada. */
async function autoArchive(client){
  const days=+client.archive_after_days;
  if(!days)return false;
  const cut=daysAgo(days);
  const ids=client.posts.filter(p=>p.status==='published'&&p.scheduled_date&&p.scheduled_date<cut).map(p=>p.id);
  if(!ids.length)return false;
  await Posts.updatePosts(ids,{archived:true});
  await Events.logEvents(ids,'archived','Sistema','Archivado automático');
  return true;
}
/* El archivado automático escribe en la base: se ejecuta una vez por cliente y sesión,
   no en cada lectura como antes. */
const archivedThisSession=new Set();
export async function loadClient(id,{allowArchive=true}={}){
  const [client,pillars,posts,highlights,stories]=await Promise.all([
    Clients.getClient(id),Clients.listPillars(id),Posts.listPosts(id),
    Media.listHighlights(id),Media.listStories(id),
  ]);
  const ids=posts.map(p=>p.id);
  const [corr,events]=await Promise.all([Events.listCorrections(ids),Events.listEvents(ids)]);
  posts.forEach(p=>{p.corrections=corr.filter(c=>c.post_id===p.id);p.events=events.filter(e=>e.post_id===p.id);});
  const out={...client,pillars,posts,highlights,stories};
  if(allowArchive&&!archivedThisSession.has(id)){
    archivedThisSession.add(id);
    if(await autoArchive(out))return loadClient(id,{allowArchive:false});
  }
  return out;
}
export const loadClients=()=>Clients.listClients();
