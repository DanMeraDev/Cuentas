"use client";

import { useState } from "react";
import { ActionForm, AmountInput, Field, Segmented, SubmitButton, inputClass } from "./forms";
import { ReceiptPicker } from "./ReceiptPicker";
import { payExternalDebt } from "@/lib/actions/external";
import { formatCents } from "@/lib/money";

type M = { id: string; name: string };
type P = { id: string; name: string; emoji: string };

export function ExternalPayForm({
  debtId,
  weOwe,
  personName,
  remainingCents,
  members,
  meId,
  pots,
  defaultPotId,
}: {
  debtId: string;
  weOwe: boolean;
  personName: string;
  remainingCents: number;
  members: M[];
  meId: string;
  pots: P[];
  defaultPotId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"personal" | "pot">(defaultPotId ? "pot" : "personal");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 rounded-full bg-paper px-3.5 py-1.5 text-[14px] font-600 active:bg-press">
        {weOwe ? `Le pagamos a ${personName}` : `${personName} nos devolvió`}
      </button>
    );
  }
  return (
    <ActionForm action={payExternalDebt} className="mt-3 space-y-3">
      <input type="hidden" name="externalDebtId" value={debtId} />
      <AmountInput name="amount" defaultValue={(remainingCents / 100).toFixed(2)} />
      <p className="text-[13px] text-ink-3">Faltan {formatCents(remainingCents)}. Puede ser una parte.</p>
      <Field label={weOwe ? "¿Quién pagó?" : "¿Quién recibió la plata?"}>
        <Segmented name="memberId" defaultValue={meId} options={members.map((m) => ({ value: m.id, label: m.id === meId ? "Yo" : m.name }))} />
      </Field>
      <Field label={weOwe ? "¿De dónde salió la plata?" : "¿A dónde va la plata?"}>
        <Segmented
          name="source"
          defaultValue={source}
          onChange={(v) => setSource(v as typeof source)}
          options={[
            { value: "personal", label: weOwe ? "De su bolsillo" : "A su bolsillo" },
            { value: "pot", label: weOwe ? "De una bolsa" : "A una bolsa" },
          ]}
        />
      </Field>
      {source === "pot" && (
        <select name="potId" defaultValue={defaultPotId ?? pots[0]?.id} className={inputClass} aria-label="Bolsa">
          {pots.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.name}
            </option>
          ))}
        </select>
      )}
      <p className="text-[13px] text-ink-3">
        {source === "personal"
          ? weOwe
            ? "Si paga más que su parte, el otro queda debiéndole la diferencia."
            : "Si recibe la parte del otro, queda debiéndosela."
          : "Se descuenta parejo de la parte de cada uno."}
      </p>
      <ReceiptPicker />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-12 rounded-full bg-paper font-700">
          Cancelar
        </button>
        <SubmitButton>Guardar</SubmitButton>
      </div>
    </ActionForm>
  );
}
