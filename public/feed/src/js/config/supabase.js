import {SUPABASE_URL,SUPABASE_ANON_KEY} from './env.js';
/* supabase-js se carga por <script> en el HTML y queda en window.supabase */
export const sb=globalThis.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
