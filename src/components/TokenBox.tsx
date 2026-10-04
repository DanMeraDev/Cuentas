"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { createShortcutToken } from "@/lib/actions/config";
import { buttonClass } from "./ui";

export function TokenBox({ hasToken }: { hasToken: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {token ? (
        <>
          <p className="break-all rounded-xl bg-paper px-3.5 py-3 font-mono text-[13px]">{token}</p>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(token);
              setCopied(true);
            }}
            className={buttonClass("primary") + " w-full"}
          >
            <Copy size={18} /> {copied ? "Copiado" : "Copiar clave"}
          </button>
          <p className="text-[13px] text-ink-3">Guárdala en el atajo ahora: por seguridad no se vuelve a mostrar.</p>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setToken(await createShortcutToken()))}
          className={buttonClass(hasToken ? "secondary" : "primary") + " w-full"}
        >
          {pending ? "Generando…" : hasToken ? "Generar una clave nueva" : "Generar mi clave del atajo"}
        </button>
      )}
      {hasToken && !token && <p className="text-[13px] text-ink-3">Ya tienes una clave. Si generas otra, la anterior deja de funcionar.</p>}
    </div>
  );
}
