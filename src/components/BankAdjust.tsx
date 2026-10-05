"use client";

import { useState } from "react";
import { ActionForm, AmountInput, SubmitButton } from "./forms";
import { setBankBalance } from "@/lib/actions/money";

export function BankAdjust({ hasAdjust }: { hasAdjust: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full py-3 text-[15px] font-600 text-ink-2">
        {hasAdjust ? "¿No coincide con tu banco? Igualar" : "Poner lo que tengo en el banco"}
      </button>
    );
  }
  return (
    <ActionForm action={setBankBalance} className="space-y-3 p-4">
      <p className="text-[14px] leading-snug text-ink-2">
        Escribe cuánto tienes ahora de verdad (banco más efectivo). La diferencia se guarda como un ajuste, por ejemplo la
        plata que ya tenías antes de usar la app.
      </p>
      <AmountInput name="actual" required large />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-12 rounded-full bg-paper font-700">
          Cancelar
        </button>
        <SubmitButton>Igualar</SubmitButton>
      </div>
    </ActionForm>
  );
}
