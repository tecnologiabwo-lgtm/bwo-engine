import {sb} from '../config/supabase.js';
export const getSession=async()=>(await sb.auth.getSession()).data.session;
export async function signIn(email,password){
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error)throw new Error(error.message);
}
export const signOut=()=>sb.auth.signOut();
