import { requireContext } from "@/lib/auth";
import { ActionForm, AmountInput, Field, Segmented, SubmitButton, inputClass } from "@/components/forms";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { Screen } from "@/components/ui";
import { createDebt } from "@/lib/actions/money";
import { todayISO } from "@/lib/periods";

export const metadata = { title: "Nuevo préstamo" };

export default async function NuevaDeudaPage() {
  const ctx = await requireContext();
  const today = todayISO(ctx.household.timezone);
  return (
    <Screen title="Préstamo o deuda" back="/balance">
      <ActionForm action={createDebt} className="space-y-4">
        <div className="space-y-4 rounded-2xl bg-sheet p-4">
          <Field label="¿Qué pasó?">
            <Segmented
              name="direction"
              options={[
                { value: "they_owe", label: "Me deben" },
                { value: "i_owe", label: "Yo debo" },
              ]}
            />
          </Field>
          {ctx.others.length > 1 ? (
            <Field label="¿Con quién?">
              <Segmented name="otherId" options={ctx.others.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
          ) : (
            <input type="hidden" name="otherId" value={ctx.others[0]?.id ?? ""} />
          )}
          <Field label="Monto">
            <AmountInput name="amount" required large />
          </Field>
          <Field label="¿Por qué?">
            <input name="description" required placeholder="Ej. Le pagué su parte del gas" className={inputClass} />
          </Field>
          <Field label="Fecha">
            <input type="date" name="occurredOn" defaultValue={today} max={today} className={inputClass} />
          </Field>
          <ReceiptPicker />
        </div>
        <SubmitButton className="w-full">Guardar</SubmitButton>
      </ActionForm>
    </Screen>
  );
}
