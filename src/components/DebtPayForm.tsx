"use client";

import { useState } from "react";
import { ActionForm, AmountInput, SubmitButton } from "./forms";
import { payDebt } from "@/lib/actions/money";
import { formatCents } from "@/lib/money";

export function DebtPayForm({ debtId, remainingCents }: { debtId: string; remainingCents: number }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 rounded-full bg-paper px-3.5 py-1.5 text-[14px] font-600 active:bg-press">
        Registrar pago
      </button>
    );
  }
  return (
    <ActionForm action={payDebt} className="mt-3 space-y-2">
      <input type="hidden" name="debtId" value={debtId} />
      <AmountInput name="amount" defaultValue={(remainingCents / 100).toFixed(2)} />
      <p className="text-[13px] text-ink-3">Faltan {formatCents(remainingCents)}. Puedes abonar una parte.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-12 rounded-full bg-paper font-700">
          Cancelar
        </button>
        <SubmitButton>Guardar</SubmitButton>
      </div>
    </ActionForm>
  );
}
