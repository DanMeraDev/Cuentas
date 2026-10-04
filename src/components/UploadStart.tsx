"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImageUp } from "lucide-react";
import { uploadImage } from "@/lib/compress";

/** Botones grandes para elegir una captura o tomar una foto. Sube y abre la confirmación. */
export function UploadStart() {
  const router = useRouter();
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await uploadImage(f);
      router.push(`/nuevo/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
      setBusy(false);
    }
  }

  return (
    <div>
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <button
        type="button"
        disabled={busy}
        onClick={() => gallery.current?.click()}
        className="flex w-full flex-col items-start rounded-[28px] bg-ink p-5 text-left text-sheet active:scale-[0.99] transition-transform disabled:opacity-70"
      >
        <ImageUp size={30} strokeWidth={2} />
        <span className="mt-6 text-[24px] leading-tight font-800 tracking-[-0.02em]">
          {busy ? "Subiendo…" : "Subir una captura"}
        </span>
        <span className="mt-1 text-[14px] text-sheet/70">
          Transferencia, Uber Eats, factura… La IA lee el monto, la fecha y el comercio.
        </span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => camera.current?.click()}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-sheet px-4 py-4 text-left active:bg-press disabled:opacity-70"
      >
        <Camera size={22} />
        <span className="text-[16px] font-600">Tomar foto de una factura</span>
      </button>
      {error && <p className="mt-3 text-[14px] text-bad">{error}</p>}
    </div>
  );
}
