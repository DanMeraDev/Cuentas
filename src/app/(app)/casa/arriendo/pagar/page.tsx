import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { loadHouse } from "@/lib/queries";
import { ActionForm, AmountInput, Field, Segmented, SubmitButton, inputClass } from "@/components/forms";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { Screen } from "@/components/ui";
import { rentPay } from "@/lib/actions/money";

export const metadata = { title: "Pago del arriendo" };

export default async function PagarArriendoPage({ searchParams }: PageProps<"/casa/arriendo/pagar">) {
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const sp = await searchParams;
  if (!house.rent) redirect("/casa/arriendo");
  if (house.rent.payment) redirect("/casa/arriendo");
  const fileId = typeof sp.archivo === "string" ? sp.archivo : null;
  return (
    <Screen title="Pago al dueño" back="/casa/arriendo">
      <ActionForm action={rentPay} className="space-y-4">
        <input type="hidden" name="next" value="/casa/arriendo" />
        <div className="space-y-4 rounded-2xl bg-sheet p-4">
          <Field label="Monto pagado">
            <AmountInput name="amount" defaultValue={(house.rent.totalCents / 100).toFixed(2)} large />
          </Field>
          <Field label="¿Quién pagó?">
            <Segmented
              name="paidBy"
              defaultValue={house.rent.payerId ?? ctx.me.id}
              options={ctx.members.map((m) => ({ value: m.id, label: m.id === ctx.me.id ? "Yo" : m.name }))}
            />
          </Field>
          <Field label="Fecha">
            <input type="date" name="occurredOn" defaultValue={house.today} max={house.today} className={inputClass} />
          </Field>
          <ReceiptPicker defaultFileId={fileId} />
        </div>
        <p className="px-1 text-[13px] text-ink-3">
          Si quien pagó no había apartado su parte, se marca como apartada al registrar el pago.
        </p>
        <SubmitButton className="w-full">Registrar pago</SubmitButton>
      </ActionForm>
    </Screen>
  );
}
