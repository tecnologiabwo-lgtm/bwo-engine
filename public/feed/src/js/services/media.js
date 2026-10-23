import {sb,run,limited} from './db.js';
export const listStories=clientId=>run(limited(sb.from('stories').select('*').eq('client_id',clientId).order('sort')));
export const addStory=row=>run(sb.from('stories').insert(row));
export const updateStory=(id,patch)=>run(sb.from('stories').update(patch).eq('id',id));
export const deleteStory=id=>run(sb.from('stories').delete().eq('id',id));
export const listHighlights=clientId=>run(limited(sb.from('highlights').select('*').eq('client_id',clientId).order('sort')));
export const addHighlight=row=>run(sb.from('highlights').insert(row));
export const updateHighlight=(id,patch)=>run(sb.from('highlights').update(patch).eq('id',id));
export const deleteHighlight=id=>run(sb.from('highlights').delete().eq('id',id));
