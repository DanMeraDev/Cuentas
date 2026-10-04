"use client";

/** Reduce la imagen a máx. 1600px de lado y la pasa a JPEG (capturas de 3 MB → ~300 KB). */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    if (!g) return file;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, h);
    g.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadImage(file: File): Promise<{ id: string; duplicateOf: string | null }> {
  const small = await compressImage(file);
  const body = new FormData();
  body.append("file", small);
  const res = await fetch("/api/archivos", { method: "POST", body });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "No se pudo subir la imagen");
  return json;
}
