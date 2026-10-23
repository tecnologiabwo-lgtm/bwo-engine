import {sb} from '../config/supabase.js';
import {PAGE_SIZE} from '../config/env.js';
/** Envoltorio único: toda consulta pasa por aquí, con error normalizado. */
export async function run(query){
  const {data,error}=await query;
  if(error)throw new Error(error.message||'Error de conexión');
  return data;
}
export const limited=q=>q.limit(PAGE_SIZE);
/** Lee TODAS las filas por páginas. build() debe devolver una consulta nueva cada vez.
    Antes el límite de 200 se aplicaba a todo el cliente y la bitácora se cortaba sin avisar. */
export async function runAll(build){
  const out=[];
  for(let from=0;;from+=PAGE_SIZE){
    const rows=await run(build().range(from,from+PAGE_SIZE-1));
    out.push(...rows);
    if(rows.length<PAGE_SIZE)return out;
  }
}
/** Divide listas largas de ids para no exceder el largo de la URL de PostgREST. */
export async function inChunks(ids,fn,size=150){
  const out=[];
  for(let i=0;i<ids.length;i+=size)out.push(...await fn(ids.slice(i,i+size)));
  return out;
}
export {sb,PAGE_SIZE};
