"use client";

import { cx } from "@/lib/cx";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ActionForm, Field, Segmented, SubmitButton, inputClass } from "@/components/forms";
import { saveContribution } from "@/lib/actions/config";
import { formatCents, parseAmountToCents } from "@/lib/money";

type M = { id: string; name: string };
type P = { id: string; name: string; emoji: string };
type Line = { label: string; amount: string; dest: string };

export function ContributionForm({
  wizard,
  back,
  members,
  pots,
  defaults,
}: {
  wizard?: boolean;
  back?: string;
  members: M[];
  pots: P[];
  defaults?: {
    id: string;
    name: string;
    source: string;
    frequency: "weekly" | "monthly";
    defaultReceiverId: string | null;
    lines: Line[];
  };
}) {
  const [lines, setLines] = useState<Line[]>(
    defaults?.lines ?? [{ label: "", amount: "", dest: pots[0] ? `pot:${pots[0].id}` : "" }],
  );
  const total = lines.reduce((a, l) => a + (parseAmountToCents(l.amount) ?? 0), 0);
  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <ActionForm action={saveContribution} className="space-y-5" resetOnSuccess={!defaults}>
      {wizard && <input type="hidden" name="wizard" value="1" />}
      {back && <input type="hidden" name="back" value={back} />}
      {defaults && <input type="hidden" name="contributionId" value={defaults.id} />}
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      <div className="space-y-4 rounded-2xl bg-sheet p-4">
        <Field label="¿Quién da esta plata?" hint="Por ejemplo: Mamá, Papá, Inquilino del garaje.">
          <input name="source" required defaultValue={defaults?.source} className={inputClass} />
        </Field>
        <Field label="Nombre del aporte" hint="Por ejemplo: Arriendo de mamá, Semanal de mamá.">
          <input name="name" required defaultValue={defaults?.name} className={inputClass} />
        </Field>
        <Field label="¿Cada cuánto llega?">
          <Segmented
            name="frequency"
            defaultValue={defaults?.frequency ?? "monthly"}
            options={[
              { value: "weekly", label: "Cada semana" },
              { value: "monthly", label: "Cada mes" },
            ]}
          />
        </Field>
        <Field label="¿Quién lo recibe normalmente?" hint="Al marcarlo como recibido igual se puede cambiar.">
          <Segmented
            name="defaultReceiverId"
            defaultValue={defaults?.defaultReceiverId ?? ""}
            options={[...members.map((m) => ({ value: m.id, label: m.name })), { value: "", label: "Varía" }]}
          />
        </Field>
      </div>

      <div className="rounded-2xl bg-sheet p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[14px] font-600 text-ink-2">¿Para qué es la plata?</p>
          <p className="amount text-[15px]">{formatCents(total)}</p>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-ink-3">
          Si un mismo aporte se reparte (por ejemplo, una parte para cada uno y otra para la comida), agrega una
          línea por cada parte.
        </p>
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="space-y-2 rounded-xl bg-paper p-3">
              <div className="flex gap-2">
                <input
                  value={l.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Ej. Para la comida"
                  aria-label="Nombre de la parte"
                  className={cx(inputClass, " flex-1 bg-sheet")}
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="flex size-12 items-center justify-center rounded-xl text-ink-3 active:bg-press"
                    aria-label="Quitar parte"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex w-32 items-center rounded-xl bg-sheet px-3">
                  <span className="mr-1 font-700 text-ink-3">$</span>
                  <input
                    value={l.amount}
                    onChange={(e) => update(i, { amount: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label="Monto"
                    className="amount w-full bg-transparent py-3 outline-none"
                  />
                </div>
                <select
                  value={l.dest}
                  onChange={(e) => update(i, { dest: e.target.value })}
                  aria-label="Destino"
                  className={cx(inputClass, " flex-1 bg-sheet")}
                >
                  <optgroup label="A una bolsa">
                    {pots.map((p) => (
                      <option key={p.id} value={`pot:${p.id}`}>
                        {p.emoji} {p.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Personal para">
                    {members.map((m) => (
                      <option key={m.id} value={`member:${m.id}`}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, { label: "", amount: "", dest: pots[0] ? `pot:${pots[0].id}` : "" }])}
          className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-2 text-[15px] font-600 text-ink-2 active:bg-press"
        >
          <Plus size={18} /> Agregar otra parte
        </button>
      </div>

      <SubmitButton className="w-full">{defaults ? "Guardar cambios" : "Agregar aporte"}</SubmitButton>
    </ActionForm>
  );
}
