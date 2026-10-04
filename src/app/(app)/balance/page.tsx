import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadHouse } from "@/lib/queries";
import { debtRemaining } from "@/lib/domain/balances";
import { BalanceHero } from "@/components/house";
import { DebtPayForm } from "@/components/DebtPayForm";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { Empty, Group, LinkButton, MemberDot, Row, Screen } from "@/components/ui";
import { settleUp } from "@/lib/actions/money";
import { formatCents } from "@/lib/money";
import { formatDay } from "@/lib/periods";

export const metadata = { title: "Cuentas entre ustedes" };

const KIND: Record<string, string> = {
  shared_expense: "Gasto compartido",
  contribution_share: "Aporte que recibió el otro",
  debt: "Préstamo",
  debt_payment: "Pago",
  settlement: "Ajuste de cuentas",
};

export default async function BalancePage() {
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const hh = ctx.household.id;
  const [debts, payments, ledger] = await Promise.all([
    db.query.debts.findMany({ where: eq(schema.debts.householdId, hh), orderBy: desc(schema.debts.occurredOn) }),
    db
      .select({ debtId: schema.memberLedger.debtId, amountCents: schema.memberLedger.amountCents })
      .from(schema.memberLedger)
      .where(and(eq(schema.memberLedger.householdId, hh), eq(schema.memberLedger.kind, "debt_payment"))),
    db.query.memberLedger.findMany({
      where: and(
        eq(schema.memberLedger.householdId, hh),
        or(eq(schema.memberLedger.debtorId, ctx.me.id), eq(schema.memberLedger.creditorId, ctx.me.id)),
      ),
      orderBy: [desc(schema.memberLedger.occurredOn)],
      limit: 40,
    }),
  ]);
  const pays = payments.filter((p): p is { debtId: string; amountCents: number } => !!p.debtId);
  const open = debts
    .map((d) => ({ d, remaining: debtRemaining(d, pays) }))
    .filter((x) => x.remaining > 0 && (x.d.debtorId === ctx.me.id || x.d.creditorId === ctx.me.id));
  const eventIds = [...new Set(ledger.map((l) => l.eventId))];
  const events = eventIds.length
    ? await db.query.events.findMany({
        where: and(inArray(schema.events.id, eventIds), or(isNull(schema.events.privateTo), eq(schema.events.privateTo, ctx.me.id))),
      })
    : [];
  const member = (id: string) => ctx.members.find((m) => m.id === id);
  const potName = (id: string) => house.pots.find((p) => p.id === id);

  return (
    <Screen title="Cuentas" back="/">
      {ctx.others.map((o) => {
        const bal = house.balances.find((b) => b.fromId === o.id || b.toId === o.id);
        return (
          <div key={o.id} className="space-y-3">
            <BalanceHero me={ctx.me} other={o} balance={bal} />
            {bal && (
              <Group title="De dónde sale">
                {bal.ledgerCents !== 0 && (
                  <Row
                    icon={<span className="text-[20px]">🧾</span>}
                    title={
                      bal.ledgerCents > 0
                        ? `${bal.fromId === ctx.me.id ? "Tú le debes" : `${member(bal.fromId)?.name} te debe`} por gastos y préstamos`
                        : `${bal.toId === ctx.me.id ? "Tú le debes" : `${member(bal.toId)?.name} te debe`} por gastos y préstamos`
                    }
                    subtitle="Gastos compartidos, préstamos y aportes que recibió uno por el otro"
                    value={formatCents(Math.abs(bal.ledgerCents))}
                  />
                )}
                {bal.deliveries.map((d, i) => (
                  <Row
                    key={i}
                    href={`/casa/bolsas/${d.potId}`}
                    icon={<span className="text-[20px]">{potName(d.potId)?.emoji}</span>}
                    title={`${d.fromId === ctx.me.id ? "Tienes" : `${member(d.fromId)?.name} tiene`} plata de ${potName(d.potId)?.name} para ${d.toId === ctx.me.id ? "ti" : member(d.toId)?.name}`}
                    subtitle="Pagó algo de la bolsa con su plata"
                    value={formatCents(d.amountCents)}
                  />
                ))}
                <div className="p-4">
                  <ActionForm action={settleUp} className="space-y-3">
                    <input type="hidden" name="otherId" value={o.id} />
                    <p className="text-[14px] text-ink-2">
                      Cuando {bal.fromId === ctx.me.id ? `le pases ${formatCents(bal.netCents)} a ${o.name}` : `${o.name} te pase ${formatCents(bal.netCents)}`},
                      regístralo aquí y todo queda en cero.
                    </p>
                    <ReceiptPicker />
                    <SubmitButton className="w-full">Ya quedamos a mano</SubmitButton>
                  </ActionForm>
                </div>
              </Group>
            )}
          </div>
        );
      })}

      <Group title="Préstamos pendientes" action={<LinkButton href="/balance/nueva" variant="secondary" className="h-9 px-3.5 text-[14px]">Nuevo</LinkButton>}>
        {open.length ? (
          open.map(({ d, remaining }) => (
            <div key={d.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-600">{d.description}</p>
                  <p className="text-[13px] text-ink-2">
                    {d.debtorId === ctx.me.id ? `Le debes a ${member(d.creditorId)?.name}` : `${member(d.debtorId)?.name} te debe`} · {formatDay(d.occurredOn)}
                    {remaining < d.amountCents ? ` · de ${formatCents(d.amountCents)}` : ""}
                  </p>
                </div>
                <span className="amount text-[16px]">{formatCents(remaining)}</span>
              </div>
              <DebtPayForm debtId={d.id} remainingCents={remaining} />
            </div>
          ))
        ) : (
          <Empty title="No hay préstamos pendientes" />
        )}
      </Group>

      <Group title="Historial entre ustedes">
        {ledger.length ? (
          ledger.map((l) => {
            const e = events.find((x) => x.id === l.eventId);
            const iOwe = l.debtorId === ctx.me.id;
            return (
              <Row
                key={l.id}
                href={e ? `/movimientos/${e.id}` : undefined}
                chevron={false}
                icon={<MemberDot color={member(l.creditorId)?.color ?? "slate"} size={12} />}
                title={e?.title ?? KIND[l.kind]}
                subtitle={`${formatDay(l.occurredOn)} · ${KIND[l.kind] ?? l.kind}`}
                value={`${iOwe ? "−" : "+"}${formatCents(l.amountCents)}`}
                valueTone={iOwe ? "bad" : "good"}
              />
            );
          })
        ) : (
          <Empty title="Sin movimientos entre ustedes" />
        )}
      </Group>
    </Screen>
  );
}
