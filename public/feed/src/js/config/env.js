/* Configuración del Feed Planner dentro de BWO Engine.
   Mismo proyecto Supabase y mismo dominio que la plataforma: la sesión se comparte.
   La clave publicable es pública por diseño: la seguridad la dan RLS y las funciones con token. */
export const SUPABASE_URL='https://getnxeflqaqzdujbxqeu.supabase.co';
export const SUPABASE_ANON_KEY='sb_publishable_JlIL10KIgsi16xgCwK_soA_yF3MZ7HV';
export const CLIENT_VIEW_URL=globalThis.location? globalThis.location.origin+'/feed/cliente.html':'/feed/cliente.html';
export const PAGE_SIZE=1000;             // tamaño de página; las listas largas se leen completas por páginas
export const BRAND={name:'Feed Planner',owner:'Big Way Offices',initials:'BW',logo:null};
