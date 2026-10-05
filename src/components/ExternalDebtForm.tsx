"use client";

import { useState } from "react";
import { ActionForm, AmountInput, Field, Segmented, SubmitButton, inputClass } from "./forms";
import { ReceiptPicker } from "./ReceiptPicker";
import { createExternalDebt } from "@/lib/actions/external";
import { formatCents, parseAmountToCents, splitEvenly } from "@/lib/money";

type M = { id: string; name: string };
type P = { id: string; name: string; emoji: string; kind: string; totalCents: number };

export function ExternalDebtForm({
  members,
  meId,
  pots,
  today,
  fileId,
}: {
  members: M[];
  meId: string;
  pots: P[];
  today: string;
  fileId: string | null;
}) {
  const [direction, setDirection] = useState<"we_owe" | "they_owe">("we_owe");
  const [mode, setMode] = useState<"pot" | "personal">("pot");
  const [split, setSplit] = useState<"equal" | "custom">("equal");
  const [amount, setAmount] = useState("");
  const cents = parseAmountToCents(amount) ?? 0;
  const even = splitEvenly(cents, members.length);
  const weOwe = direction === "we_owe";
  const label = (m: M) => (m.id === meId ? "Yo" : m.name);

  return (
    <ActionForm action={createExternalDebt} className="space-y-4">
      <div className="space-y-4 rounded-2xl bg-sheet p-4">
        <Field label="¿Qué pasó?">
          <Segmented
            name="direction"
            defaultValue={direction}
            onChange={(v) => setDirection(v as typeof direction)}
            options={[
              { value: "we_owe", label: "Nos prestaron" },
              { value: "they_owe", label: "Le prestamos" },
            ]}
          />
        </Field>
        <Field label={weOwe ? "¿Quién nos prestó?" : "¿A quién le prestamos?"}>
          <input name="personName" required placeholder="Ej. Tía Rosa" className={inputClass} />
        </Field>
        <Field label="Monto">
          <div onChange={(e) => setAmount((e.target as HTMLInputElement).value)}>
            <AmountInput name="amount" required large />
          </div>
        </Field>
        <Field label="¿Para qué?">
          <input name="description" placeholder={weOwe ? "Ej. Para completar el arriendo" : "Ej. Para su pasaje"} className={inputClass} />
        </Field>
        <Field label="Fecha">
          <input type="date" name="occurredOn" defaultValue={today} max={today} className={inputClass} />
        </Field>
      </div>

      <div className="space-y-4 rounded-2xl bg-sheet p-4">
        <Field label={weOwe ? "¿Para quién es la plata?" : "¿De quién es la plata que prestamos?"}>
          <Segmented
            name="mode"
            defaultValue={mode}
            onChange={(v) => setMode(v as typeof mode)}
            options={[
              { value: "pot", label: "De la casa", hint: "Se divide entre todos" },
              { value: "personal", label: "De una persona", hint: "Solo de quien la recibió" },
            ]}
          />
        </Field>
        <Field label={weOwe ? "¿Quién recibió la plata?" : "¿Quién entregó la plata?"}>
          <Segmented name="memberId" defaultValue={meId} options={members.map((m) => ({ value: m.id, label: label(m) }))} />
        </Field>
        {mode === "pot" && (
          <>
            <Field label={weOwe ? "¿A qué bolsa entra?" : "¿De qué bolsa sale?"}>
              <select name="potId" className={inputClass} defaultValue={pots[0]?.id}>
                {pots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name} (tiene {formatCents(p.totalCents)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={weOwe ? "¿Cuánto debe cada uno?" : "¿De cuánto es cada uno?"}>
              <Segmented
                name="split"
                defaultValue={split}
                onChange={(v) => setSplit(v as typeof split)}
                options={[
                  { value: "equal", label: "Mitad y mitad", hint: cents ? `${formatCents(even[0])} c/u` : undefined },
                  { value: "custom", label: "Otro reparto" },
                ]}
              />
            </Field>
            {split === "custom" && (
              <div className="space-y-2">
                {members.map((m, i) => (
                  <label key={m.id} className="flex items-center gap-3">
                    <span className="flex-1 text-[15px] font-600">{label(m)}</span>
                    <span className="text-ink-3">$</span>
                    <input
                      name={`share_${m.id}`}
                      inputMode="decimal"
                      defaultValue={cents ? (even[i] / 100).toFixed(2) : ""}
                      className="amount w-28 rounded-xl bg-paper px-3 py-3 text-right outline-none"
                    />
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        <ReceiptPicker defaultFileId={fileId} />
      </div>
      <SubmitButton className="w-full">Guardar préstamo</SubmitButton>
    </ActionForm>
  );
}
