"use client";

import { ActionForm, Field, SubmitButton, inputClass } from "@/components/forms";
import { saveHousehold } from "@/lib/actions/config";
import { ColorPicker } from "./ColorPicker";

export function HouseholdForm({
  wizard,
  defaults,
}: {
  wizard?: boolean;
  defaults?: { name: string; myName: string; myColor: string; otherName: string; otherColor: string };
}) {
  return (
    <ActionForm action={saveHousehold} className="space-y-5">
      {wizard && <input type="hidden" name="wizard" value="1" />}
      <div className="rounded-2xl bg-sheet p-4">
        <Field label="Nombre de la casa" hint="Solo para reconocerla, por ejemplo «Depa de la Amazonas».">
          <input name="name" required defaultValue={defaults?.name} className={inputClass} />
        </Field>
      </div>
      <div className="rounded-2xl bg-sheet p-4 space-y-4">
        <Field label="Tu nombre">
          <input name="myName" required defaultValue={defaults?.myName} className={inputClass} />
        </Field>
        <Field label="Tu color">
          <ColorPicker name="myColor" defaultValue={defaults?.myColor ?? "cobalt"} />
        </Field>
      </div>
      <div className="rounded-2xl bg-sheet p-4 space-y-4">
        <Field label="Con quién vives" hint="Le vas a mandar un enlace para que cree su cuenta.">
          <input name="otherName" required defaultValue={defaults?.otherName} className={inputClass} />
        </Field>
        <Field label="Su color">
          <ColorPicker name="otherColor" defaultValue={defaults?.otherColor ?? "tangerine"} />
        </Field>
      </div>
      <SubmitButton className="w-full">{wizard ? "Continuar" : "Guardar"}</SubmitButton>
    </ActionForm>
  );
}
