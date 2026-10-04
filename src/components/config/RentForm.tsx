"use client";

import { useState } from "react";
import { ActionForm, AmountInput, Field, Segmented, SubmitButton, inputClass } from "@/components/forms";
import { saveRent } from "@/lib/actions/config";
import { formatCents, parseAmountToCents } from "@/lib/money";

type M = { id: string; name: string };
type P = { id: string; name: string; emoji: string; kind: string };

export function RentForm({
  wizard,
  members,
  pots,
  defaults,
}: {
  wizard?: boolean;
  members: M[];
  pots: P[];
  defaults?: {
    total: string;
    potId: string;
    payerId: string | null;
    dueDay: number;
    shares: Record<string, string>;
  };
}) {
  const [total, setTotal] = useState(defaults?.total ?? "");
  const [shares, setShares] = useState<Record<string, string>>(defaults?.shares ?? {});
  const totalC = parseAmountToCents(total) ?? 0;
  const sharesC = Object.values(shares).reduce((a, s) => a + (parseAmountToCents(s) ?? 0), 0);
  const rest = totalC - sharesC;
  const rentPot = defaults?.potId ?? pots.find((p) => p.kind === "rent")?.id ?? pots[0]?.id;

  return (
    <ActionForm action={saveRent} className="space-y-5">
      {wizard && <input type="hidden" name="wizard" value="1" />}
      <div className="space-y-4 rounded-2xl bg-sheet p-4">
        <Field label="Total del arriendo al mes">
          <div onChange={(e) => setTotal((e.target as HTMLInputElement).value)}>
            <AmountInput name="total" defaultValue={defaults?.total} required />
          </div>
        </Field>
        <Field label="Día de pago" hint="Para los recordatorios.">
          <input name="dueDay" type="number" min={1} max={31} defaultValue={defaults?.dueDay ?? 1} className={inputClass} />
        </Field>
        <Field label="Bolsa del arriendo">
          <select name="potId" defaultValue={rentPot} className={inputClass}>
            {pots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-4 rounded-2xl bg-sheet p-4">
        <p className="text-[14px] font-600 text-ink-2">Parte que pone cada uno de su bolsillo</p>
        {members.map((m) => (
          <Field key={m.id} label={m.name}>
            <div onChange={(e) => setShares((s) => ({ ...s, [m.id]: (e.target as HTMLInputElement).value }))}>
              <AmountInput name={`share_${m.id}`} defaultValue={defaults?.shares[m.id]} required />
            </div>
          </Field>
        ))}
        {totalC > 0 && (
          <p className="rounded-xl bg-paper px-3.5 py-3 text-[14px] leading-snug text-ink-2">
            {rest > 0 ? (
              <>
                Las partes suman <strong className="text-ink">{formatCents(sharesC)}</strong>. Los{" "}
                <strong className="text-ink">{formatCents(rest)}</strong> que faltan se cubren con aportes (por ejemplo,
                plata que da la familia o lo que pagan por el garaje). Los configuras en el siguiente paso.
              </>
            ) : rest === 0 ? (
              <>Las partes cubren el arriendo completo.</>
            ) : (
              <>Las partes suman {formatCents(sharesC)}, más que el arriendo. Revisa los montos.</>
            )}
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl bg-sheet p-4">
        <p className="text-[14px] font-600 text-ink-2">¿Quién le paga al dueño normalmente?</p>
        <Segmented
          name="payerId"
          defaultValue={defaults?.payerId ?? members[0]?.id}
          options={members.map((m) => ({ value: m.id, label: m.name }))}
        />
        <p className="text-[13px] text-ink-3">Igual se puede elegir otra persona cada mes.</p>
      </div>

      <SubmitButton className="w-full">{wizard ? "Continuar" : "Guardar"}</SubmitButton>
      {wizard && (
        <button type="submit" name="noRent" value="1" formNoValidate className="w-full py-2 text-[15px] font-600 text-ink-2">
          No pagamos arriendo
        </button>
      )}
    </ActionForm>
  );
}
