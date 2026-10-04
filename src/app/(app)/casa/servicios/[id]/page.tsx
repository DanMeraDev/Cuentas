import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadHouse } from "@/lib/queries";
import { ActionForm, AmountInput, Field, Segmented, SubmitButton, inputClass } from "@/components/forms";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { Empty, Group, Notice, Row, Screen } from "@/components/ui";
import { payService } from "@/lib/actions/money";
import { formatCents } from "@/lib/money";
import { formatDay, periodLabel, previousPeriods } from "@/lib/periods";
import { addMonths, format, parseISO } from "date-fns";

export default async function ServicioPage({ params, searchParams }: PageProps<"/casa/servicios/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const state = house.services.find((s) => s.service.id === id);
  if (!state) notFound();
  const { service, status } = state;
  const payments = await db.query.servicePayments.findMany({
    where: eq(schema.servicePayments.serviceId, service.id),
    orderBy: desc(schema.servicePayments.paidOn),
    limit: 24,
  });
  const paid = new Set(payments.flatMap((p) => p.periods));
  const nextMonth = format(addMonths(parseISO(`${house.month}-15`), 1), "yyyy-MM");
  // meses que se pueden marcar: los pendientes, los últimos 3 y el siguiente (por si pagan adelantado)
  const choices = Array.from(new Set([...status.pending, ...previousPeriods(house.month, 3), nextMonth]))
    .filter((p) => !paid.has(p))
    .sort();
  const preselected = service.accumulable ? status.pending : status.pending.slice(0, 1);
  const fileId = typeof sp.archivo === "string" ? sp.archivo : null;
  const presetAmount = typeof sp.monto === "string" ? sp.monto : status.estimateCents ? (status.estimateCents * Math.max(1, preselected.length) / 100).toFixed(2) : "";

  return (
    <Screen title={`${service.emoji} ${service.name}`} back="/casa/servicios">
      {status.pending.length > 0 ? (
        <Notice tone={status.overdue.length ? "warn" : "muted"}>
          {service.accumulable && status.pending.length > 1
            ? `Debes ${status.pending.map((p) => periodLabel(p)).join(" y ")}. Acuérdate de pagarlos juntos.`
            : `Sin pagar: ${status.pending.map((p) => periodLabel(p)).join(", ")}.`}
          {status.estimateCents > 0 && ` Según el último pago, serían unos ${formatCents(status.committedCents)}.`}
        </Notice>
      ) : (
        <Notice tone="good">Al día. Último pago el {payments[0] ? formatDay(payments[0].paidOn) : "—"}.</Notice>
      )}

      <Group title="Registrar pago">
        <ActionForm action={payService} className="space-y-4 p-4">
          <input type="hidden" name="serviceId" value={service.id} />
          <Field label="Monto pagado" hint={`Se descuenta de la bolsa ${state.pot?.name ?? ""}.`}>
            <AmountInput name="amount" defaultValue={presetAmount} required large />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[14px] font-600 text-ink-2">¿Qué meses cubre?</legend>
            <div className="flex flex-wrap gap-2">
              {choices.map((p) => (
                <label key={p} className="cursor-pointer">
                  <input type="checkbox" name="periods" value={p} defaultChecked={preselected.includes(p)} className="peer sr-only" />
                  <span className="block rounded-full bg-paper px-3.5 py-2 text-[14px] font-600 peer-checked:bg-ink peer-checked:text-sheet peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--m-cobalt)]">
                    {periodLabel(p, { short: true })}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="¿Quién pagó?">
            <Segmented
              name="paidBy"
              defaultValue={ctx.me.id}
              options={ctx.members.map((m) => ({ value: m.id, label: m.id === ctx.me.id ? "Yo" : m.name }))}
            />
          </Field>
          <Field label="Fecha">
            <input type="date" name="occurredOn" defaultValue={house.today} max={house.today} className={inputClass} />
          </Field>
          <ReceiptPicker defaultFileId={fileId} />
          <SubmitButton className="w-full">Guardar pago</SubmitButton>
        </ActionForm>
      </Group>

      <Group title="Historial">
        {payments.length ? (
          payments.map((p) => (
            <Row
              key={p.id}
              href={`/movimientos/${p.eventId}`}
              title={p.periods.map((x) => periodLabel(x)).join(" + ")}
              subtitle={`Pagado el ${formatDay(p.paidOn)} por ${ctx.members.find((m) => m.id === p.paidBy)?.name}`}
              value={formatCents(p.amountCents)}
            />
          ))
        ) : (
          <Empty title="Todavía no hay pagos" />
        )}
      </Group>
    </Screen>
  );
}
