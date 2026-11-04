/* Imágenes del Feed: compresión en el navegador + subida a Supabase Storage.
   Se guarda la URL pública en posts.images (antes iba el data-URL completo),
   así la base no se llena y el Feed clásico/aislado las muestra igual. */
import { supabase } from "@/shared/lib/supabase";

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Imagen ilegible")); i.src = src; });

/** Recorta cubriendo (como Instagram) a w×h y baja calidad hasta targetKB. */
export async function compressImage(file, { w = 1080, h = 1350, targetKB = 260, minQuality = 0.62 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high";
    const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const type = c.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    let q = 0.92, blob;
    do { blob = await new Promise((r) => c.toBlob(r, type, q)); q = Math.round((q - 0.06) * 100) / 100; } while (blob.size / 1024 > targetKB && q > minQuality);
    return { blob, type, kb: Math.round(blob.size / 1024), originalKB: Math.round(file.size / 1024) };
  } finally { URL.revokeObjectURL(url); }
}

export async function uploadImage(clientId, file, dims) {
  const { blob, type, kb, originalKB } = await compressImage(file, dims);
  const ext = type === "image/webp" ? "webp" : "jpg";
  const path = `${clientId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("feed-media").upload(path, blob, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`No se pudo subir la imagen: ${error.message}`);
  const { data } = supabase.storage.from("feed-media").getPublicUrl(path);
  return { url: data.publicUrl, kb, originalKB };
}

export function pickFiles({ multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/jpeg,image/png,image/webp"; input.multiple = multiple;
    input.onchange = () => resolve([...(input.files || [])]);
    input.click();
  });
}
