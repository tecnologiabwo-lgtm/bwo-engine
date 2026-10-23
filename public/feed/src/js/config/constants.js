export const FORMATS={
  post_sq :{label:'Publicación cuadrada'  ,short:'Publicación',ratio:'1:1'        ,px:'1080×1080',w:1080,h:1080,aspect:1     ,icon:'▢',kind:'post'},
  post_v  :{label:'Publicación vertical'  ,short:'Publicación',ratio:'4:5'        ,px:'1080×1350',w:1080,h:1350,aspect:4/5   ,icon:'▯',kind:'post'},
  post_h  :{label:'Publicación horizontal',short:'Publicación',ratio:'1.91:1'     ,px:'1080×566' ,w:1080,h:566 ,aspect:1.91  ,icon:'▭',kind:'post'},
  carousel:{label:'Carrusel'              ,short:'Carrusel'   ,ratio:'4:5 · máx 20',px:'1080×1350',w:1080,h:1350,aspect:4/5  ,icon:'▤',kind:'carousel'},
  reel    :{label:'Reel'                  ,short:'Reel'       ,ratio:'9:16'       ,px:'1080×1920',w:1080,h:1920,aspect:9/16  ,icon:'▶',kind:'reel'},
};
export const STATUS={
  draft    :{label:'Borrador'     ,clientLabel:'En preparación'         ,color:'var(--st-draft)'    ,ico:'✎'},
  pending  :{label:'Pendiente'    ,clientLabel:'Pendiente de tu aprobación',color:'var(--st-pending)',ico:'⏳'},
  changes  :{label:'Cambios pedidos',clientLabel:'Cambios solicitados'  ,color:'var(--st-changes)'  ,ico:'↺'},
  approved :{label:'Aprobado'     ,clientLabel:'Aprobado'               ,color:'var(--st-approved)' ,ico:'✓'},
  published:{label:'Publicado'    ,clientLabel:'Publicado'              ,color:'var(--st-published)',ico:'●'},
};
export const EVENTS={
  created  :{label:'Publicación creada'      ,ico:'✚',color:'var(--st-draft)'},
  sent     :{label:'Enviada al cliente'      ,ico:'📤',color:'var(--st-pending)'},
  changes  :{label:'Cambios solicitados'     ,ico:'↺',color:'var(--st-changes)'},
  updated  :{label:'Archivo actualizado'     ,ico:'🖼',color:'var(--brand-blue)'},
  edited   :{label:'Contenido editado'       ,ico:'✎',color:'var(--brand-blue)'},
  approved :{label:'Aprobada'                ,ico:'✓',color:'var(--st-approved)'},
  published:{label:'Publicada'               ,ico:'●',color:'var(--st-published)'},
  archived :{label:'Archivada'               ,ico:'🗄',color:'var(--text-faint)'},
  restored :{label:'Restaurada'              ,ico:'↩',color:'var(--text-faint)'},
};
export const DIMS_REF=[
  {ico:'👤',name:'Foto de perfil',note:'Círculo · centrado'          ,px:'320×320 mín'},
  {ico:'⭕',name:'Destacada'     ,note:'Círculo ~161px · centrar'     ,px:'1080×1920'},
  {ico:'📱',name:'Historia'      ,note:'9:16 · zonas seguras 12%'     ,px:'1080×1920'},
  {ico:'▯',name:'Post vertical' ,note:'4:5 · máximo alcance'         ,px:'1080×1350'},
  {ico:'▤',name:'Carrusel'      ,note:'Misma proporción en todas'    ,px:'1080×1350'},
  {ico:'▶',name:'Reel'          ,note:'9:16 · portada aprobable'     ,px:'1080×1920'},
  {ico:'🔲',name:'Cuadrícula'    ,note:'Recorta a 3:4 (desde 2025)'   ,px:'1080×1440'},
];
export const DEFAULT_PILLARS=[
  {name:'Educar'   ,color:'#6C3BF5'},{name:'Inspirar',color:'#22D3C5'},
  {name:'Entretener',color:'#F5A623'},{name:'Vender'  ,color:'#E6197E'},
  {name:'Comunidad',color:'#4A8CFF'},
];
export const DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
export const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const DOW=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
