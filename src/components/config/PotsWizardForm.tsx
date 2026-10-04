"use client";

import { cx } from "@/lib/cx";
import { ActionForm, SubmitButton, inputClass } from "@/components/forms";
import { saveWizardPots } from "@/lib/actions/config";
import { SUGGESTED_POTS } from "@/lib/defaults";

export function PotsWizardForm({ existingKinds, existingNames }: { existingKinds: string[]; existingNames: string[] }) {
  return (
    <ActionForm action={saveWizardPots} className="space-y-5">
      <input type="hidden" name="wizard" value="1" />
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-sheet">
        {SUGGESTED_POTS.map((p) => {
          const exists = existingKinds.includes(p.kind);
          return (
            <label key={p.key} className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-[22px]">{p.emoji}</span>
              <span className="flex-1 text-[16px] font-600">{p.name}</span>
              {exists ? (
                <span className="text-[13px] text-ink-3">Creada</span>
              ) : (
                <input type="checkbox" name={`pot_${p.key}`} defaultChecked className="size-5 accent-[var(--ink)]" />
              )}
            </label>
          );
        })}
        {existingNames
          .filter((n) => !SUGGESTED_POTS.some((p) => p.name === n))
          .map((n) => (
            <div key={n} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex-1 text-[16px] font-600">{n}</span>
              <span className="text-[13px] text-ink-3">Creada</span>
            </div>
          ))}
      </div>
      <div className="rounded-2xl bg-sheet p-4">
        <p className="mb-3 text-[14px] font-600 text-ink-2">¿Otra bolsa? (opcional)</p>
        <div className="flex gap-2">
          <input name="customEmoji" placeholder="🎉" maxLength={4} className={cx(inputClass, " w-16 text-center")} aria-label="Emoji" />
          <input name="customName" placeholder="Nombre de la bolsa" aria-label="Nombre de la bolsa" className={cx(inputClass, " flex-1")} />
        </div>
      </div>
      <SubmitButton className="w-full">Continuar</SubmitButton>
    </ActionForm>
  );
}
