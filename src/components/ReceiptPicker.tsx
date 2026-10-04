"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { uploadImage } from "@/lib/compress";

/** Adjuntar una captura opcional a un formulario (deja el id en un campo oculto). */
export function ReceiptPicker({ name = "fileId", defaultFileId }: { name?: string; defaultFileId?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [fileId, setFileId] = useState<string | null>(defaultFileId ?? null);
  const [preview, setPreview] = useState<string | null>(defaultFileId ? `/api/archivos/${defaultFileId}` : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    setPreview(URL.createObjectURL(f));
    try {
      const { id } = await uploadImage(f);
      setFileId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={fileId ?? ""} />
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
      {preview ? (
        <div className="relative flex items-center gap-3 rounded-xl bg-paper p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Captura adjunta" className="size-16 rounded-lg object-cover" />
          <span className="flex-1 text-[14px] text-ink-2">{busy ? "Subiendo…" : "Captura adjunta"}</span>
          <button
            type="button"
            onClick={() => {
              setFileId(null);
              setPreview(null);
              if (input.current) input.current.value = "";
            }}
            className="flex size-10 items-center justify-center rounded-full text-ink-3 active:bg-press"
            aria-label="Quitar captura"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-4 text-[15px] font-600 text-ink-2 active:bg-press"
        >
          <Camera size={18} /> Adjuntar captura (opcional)
        </button>
      )}
      {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
    </div>
  );
}
