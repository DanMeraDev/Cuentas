import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadHouse } from "@/lib/queries";
import { ActionForm, AmountInput, Field, SubmitButton, inputClass } from "@/components/forms";
import { EventItem } from "@/components/house";
import { ActionButton } from "@/components/actions";
import { Empty, Group, MemberDot, Notice, Row, Screen } from "@/components/ui";
import { coverShortfall, handOver, movePotMoney } from "@/lib/actions/money";
import { formatCents } from "@/lib/money";

export default async function BolsaPage({ params }: PageProps<"/casa/bolsas/[id]">) {
  const { id } = await params;
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const pot = house.pots.find((p) => p.id === id);
  if (!pot) notFound();
  const name = (mid: string) => ctx.members.find((m) => m.id === mid)?.name ?? "—";
  const otherPots = house.pots.filter((p) => p.id !== pot.id);
  const shortfall = house.shortfalls.find((s) => s.pot.id === pot.id);
  const deliveries = house.deliveries.filter((d) => d.potId === pot.id);

  const movementEventIds = db
    .selectDistinct({ id: schema.potMovements.eventId })
    .from(schema.potMovements)
    .where(eq(schema.potMovements.potId, pot.id));
  const events = await db.query.events.findMany({
    where: and(
      eq(schema.events.householdId, ctx.household.id),
      inArray(schema.events.id, movementEventIds),
      or(isNull(schema.events.privateTo), eq(schema.events.privateTo, ctx.me.id)),
    ),
    orderBy: [desc(schema.events.occurredOn), desc(schema.events.createdAt)],
    limit: 30,
  });
  const services = house.services.filter((s) => s.service.potId === pot.id && s.status.pending.length);

  return (
    <Screen title={`${pot.emoji} ${pot.name}`} back="/casa">
      <div className="rounded-[28px] bg-sheet p-5">
        <p className="text-[14px] font-600 text-ink-3">Saldo de la bolsa</p>
        <p className={`amount mt-1 text-[44px] leading-none ${pot.totalCents < 0 ? "text-bad" : ""}`}>
          {formatCents(pot.totalCents)}
        </p>
        {pot.committedCents > 0 && (
          <p className="mt-3 text-[14px] leading-snug text-ink-2">
            {formatCents(pot.committedCents)} están reservados para{" "}
            {services.map((s) => `${s.service.name} (${s.status.pending.length} ${s.status.pending.length === 1 ? "mes" : "meses"})`).join(", ")}.
            Sobrante disponible: <strong className="amount text-ink">{formatCents(Math.max(0, pot.availableCents))}</strong>.
          </p>
        )}
      </div>

      {shortfall && (
        <Group title={`Faltan ${formatCents(shortfall.missingCents)}`} footer="Elige cómo se cubre lo que falta.">
          <div className="space-y-3 p-4">
            {otherPots.filter((p) => p.totalCents >= shortfall.missingCents).length > 0 && (
              <ActionForm action={coverShortfall} className="space-y-2">
                <input type="hidden" name="potId" value={pot.id} />
                <input type="hidden" name="mode" value="pot" />
                <select name="sourcePotId" className={inputClass} aria-label="Bolsa de donde sale">
                  {otherPots
                    .filter((p) => p.totalCents >= shortfall.missingCents)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.emoji} {p.name} (tiene {formatCents(p.totalCents)})
                      </option>
                    ))}
                </select>
                <SubmitButton className="w-full">Cubrir con esa bolsa</SubmitButton>
              </ActionForm>
            )}
            <ActionButton action={coverShortfall} fields={{ potId: pot.id, mode: "split" }} variant="secondary">
              Dividir entre todos ({formatCents(Math.ceil(shortfall.missingCents / ctx.members.length))} c/u)
            </ActionButton>
          </div>
        </Group>
      )}

      <Group title="¿Quién tiene la plata?">
        {ctx.members.map((m) => {
          const v = pot.byMember[m.id] ?? 0;
          return (
            <Row
              key={m.id}
              icon={<MemberDot color={m.color} size={14} />}
              title={m.name}
              subtitle={v < 0 ? "Pagó cosas de la bolsa con su plata" : v > 0 ? "La tiene guardada" : "Nada"}
              value={formatCents(Math.abs(v))}
              valueTone={v === 0 ? "muted" : v < 0 ? "warn" : undefined}
            />
          );
        })}
      </Group>

      {deliveries.map((d, i) => (
        <Group key={i} title="Plata por entregar">
          <div className="p-4">
            <p className="mb-3 text-[15px]">
              {name(d.fromId)} le tiene que pasar <strong className="amount">{formatCents(d.amountCents)}</strong> a {name(d.toId)}.
            </p>
            <ActionButton
              action={handOver}
              fields={{ potId: pot.id, fromId: d.fromId, toId: d.toId, amount: (d.amountCents / 100).toFixed(2) }}
            >
              Ya se la pasó
            </ActionButton>
          </div>
        </Group>
      ))}

      {pot.totalCents > 0 && otherPots.length > 0 && (
        <Group title="Mover sobrante a otra bolsa">
          <ActionForm action={movePotMoney} className="space-y-3 p-4" resetOnSuccess>
            <input type="hidden" name="fromPotId" value={pot.id} />
            <Field label="A la bolsa">
              <select name="toPotId" className={inputClass}>
                {otherPots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monto">
              <AmountInput name="amount" defaultValue={(Math.max(0, pot.availableCents) / 100).toFixed(2)} />
            </Field>
            <SubmitButton className="w-full" variant="secondary">
              Mover
            </SubmitButton>
          </ActionForm>
        </Group>
      )}

      {ctx.members.length > 1 && pot.totalCents > 0 && (
        <Group title="Pasarle plata de la bolsa a otro">
          <ActionForm action={handOver} className="space-y-3 p-4" resetOnSuccess>
            <input type="hidden" name="potId" value={pot.id} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="De">
                <select name="fromId" defaultValue={ctx.me.id} className={inputClass}>
                  {ctx.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Para">
                <select name="toId" defaultValue={ctx.others[0]?.id} className={inputClass}>
                  {ctx.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Monto">
              <AmountInput name="amount" />
            </Field>
            <SubmitButton className="w-full" variant="secondary">
              Registrar entrega
            </SubmitButton>
          </ActionForm>
        </Group>
      )}

      <Group title="Movimientos de la bolsa">
        {events.length ? events.map((e) => <EventItem key={e.id} event={e} members={ctx.members} />) : <Empty title="Sin movimientos" />}
      </Group>

      {pot.totalCents === 0 && !events.length && (
        <div className="mt-4">
          <Notice>La plata entra a esta bolsa cuando marcan un aporte como recibido.</Notice>
        </div>
      )}
    </Screen>
  );
}
