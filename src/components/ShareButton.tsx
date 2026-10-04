"use client";

import { useState } from "react";
import { Copy, Share } from "lucide-react";
import { buttonClass } from "./ui";

export function ShareButton({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Cuentas de la casa", text, url });
        return;
      } catch {
        // cancelado: caemos a copiar
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" onClick={onClick} className={buttonClass("primary") + " w-full"}>
      {copied ? <Copy size={18} /> : <Share size={18} />}
      {copied ? "Enlace copiado" : "Enviar enlace de invitación"}
    </button>
  );
}
