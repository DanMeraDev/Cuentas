"use client";

import { cx } from "@/lib/cx";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/forms";
import { saveService } from "@/lib/actions/config";

type P = { id: string; name: string; emoji: string; kind: string };

export function ServiceForm({
  wizard,
  pots,
  defaults,
  suggestion,
}: {
  wizard?: boolean;
  pots: P[];
  defaults?: { id: string; name: string; emoji: string; potId: string; accumulable: boolean };
  suggestion?: { name: string; emoji: string; accumulable: boolean };
}) {
  const potId = defaults?.potId ?? pots.find((p) => p.kind === "services")?.id ?? pots[0]?.id;
  const d = defaults ?? suggestion;
  return (
    <ActionForm action={saveService} className="space-y-4" resetOnSuccess={!defaults}>
      {wizard && <input type="hidden" name="wizard" value="1" />}
      {defaults && <input type="hidden" name="serviceId" value={defaults.id} />}
      <div className="flex gap-2">
        <input name="emoji" defaultValue={d?.emoji} placeholder="🧾" maxLength={4} aria-label="Emoji" className={cx(inputClass, " w-16 text-center")} />
        <input name="name" required defaultValue={d?.name} placeholder="Nombre del servicio" aria-label="Nombre" className={cx(inputClass, " flex-1")} />
      </div>
      <Field label="Se paga de la bolsa">
        <select name="potId" defaultValue={potId} className={inputClass}>
          {pots.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-start gap-3 rounded-xl bg-paper px-3.5 py-3">
        <input type="checkbox" name="accumulable" defaultChecked={d?.accumulable} className="mt-0.5 size-5 accent-[var(--ink)]" />
        <span>
          <span className="block text-[15px] font-600">Se puede pagar varios meses juntos</span>
          <span className="block text-[13px] text-ink-3">
            Si un mes no se paga, queda pendiente y te recuerda pagarlo junto con el siguiente.
          </span>
        </span>
      </label>
      <SubmitButton className="w-full" variant={defaults ? "primary" : "secondary"}>
        {defaults ? "Guardar cambios" : "Agregar servicio"}
      </SubmitButton>
    </ActionForm>
  );
}
