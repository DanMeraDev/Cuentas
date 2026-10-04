"use client";

import { ActionForm, SubmitButton, inputClass } from "@/components/forms";
import { savePot } from "@/lib/actions/config";
import { cx } from "@/lib/cx";

const KINDS = [
  { value: "other", label: "Otra" },
  { value: "rent", label: "Arriendo" },
  { value: "food", label: "Comida" },
  { value: "services", label: "Servicios" },
];

export function PotEditor({ pot }: { pot?: { id: string; name: string; emoji: string; kind: string } }) {
  return (
    <ActionForm action={savePot} className="space-y-2 p-4" resetOnSuccess={!pot}>
      {pot && <input type="hidden" name="potId" value={pot.id} />}
      <div className="flex gap-2">
        <input name="emoji" defaultValue={pot?.emoji} placeholder="💰" maxLength={4} aria-label="Emoji" className={cx(inputClass, "w-16 text-center")} />
        <input name="name" defaultValue={pot?.name} required placeholder="Nombre" aria-label="Nombre" className={cx(inputClass, "flex-1")} />
      </div>
      <div className="flex gap-2">
        <select name="kind" defaultValue={pot?.kind ?? "other"} aria-label="Tipo" className={cx(inputClass, "flex-1")}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              Tipo: {k.label}
            </option>
          ))}
        </select>
        <SubmitButton variant="secondary">{pot ? "Guardar" : "Crear"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
