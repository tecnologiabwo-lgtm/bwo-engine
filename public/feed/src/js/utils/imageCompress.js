/* Compresión de imágenes en el navegador.
   Redimensiona a la medida exacta del formato y busca la calidad más baja
   que siga siendo visualmente idéntica, deteniéndose al alcanzar el peso objetivo. */
const TYPES=['image/webp','image/jpeg'];
const supports=t=>document.createElement('canvas').toDataURL(t).startsWith('data:'+t);
export const bestType=()=>TYPES.find(supports)||'image/jpeg';

const loadImage=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Imagen ilegible'));i.src=src;});
const readFile=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('No se pudo leer el archivo'));r.readAsDataURL(file);});

/** Dibuja cubriendo el lienzo (recorte centrado), como hace Instagram. */
function drawCover(img,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';
  const s=Math.max(w/img.width,h/img.height);
  const dw=img.width*s,dh=img.height*s;
  ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
  return c;
}
const kb=dataUrl=>dataUrl.length*0.75/1024;

/**
 * @param {File|string} input archivo o data-URL
 * @param {{w:number,h:number,targetKB?:number,minQuality?:number,cover?:boolean}} opts
 * @returns {{dataUrl:string,kb:number,originalKB:number,width:number,height:number,type:string}}
 */
export async function compressImage(input,opts={}){
  const {w=1080,h=1350,targetKB=190,minQuality=0.62,cover=true}=opts;
  const src=typeof input==='string'?input:await readFile(input);
  const originalKB=typeof input==='string'?kb(src):input.size/1024;
  const img=await loadImage(src);
  let tw=w,th=h;
  if(!cover){const s=Math.min(1,w/img.width);tw=Math.round(img.width*s);th=Math.round(img.height*s);}
  const canvas=cover?drawCover(img,tw,th):drawCover(img,tw,th);
  const type=bestType();
  let q=0.92,out=canvas.toDataURL(type,q);
  while(kb(out)>targetKB&&q>minQuality){q=Math.round((q-0.06)*100)/100;out=canvas.toDataURL(type,q);}
  return {dataUrl:out,kb:kb(out),originalKB,width:tw,height:th,type,quality:q};
}

/** Abre el selector de archivos y devuelve la imagen ya comprimida. */
export function pickImage(onDone,opts={},onError){
  const input=document.createElement('input');
  input.type='file';input.accept='image/*';
  input.onchange=async()=>{
    const f=input.files&&input.files[0];if(!f)return;
    try{onDone(await compressImage(f,opts));}
    catch(e){(onError||console.error)(e);}
  };
  input.click();
}
