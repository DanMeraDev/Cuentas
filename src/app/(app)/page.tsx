import Link from "next/link";
import { Bell } from "lucide-react";
import { CalculatorButton } from "@/components/Calculator";
import { requireContext } from "@/lib/auth";
import { listEvents, loadHouse, pendingDrafts, unreadCount } from "@/lib/queries";
import { BalanceHero, EventItem, PotRow, RentMini } from "@/components/house";
import { ContributionCheck, type DueItem } from "@/components/actions";
import { Empty, Group, LinkButton, Notice, Row, Screen } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { periodLabel } from "@/lib/periods";

export default async function HomePage() {
  const ctx = await requireContext();
  const [house, events, unread, drafts] = await Promise.all([
    loadHouse(ctx),
    listEvents(ctx, { limit: 6 }),
    unreadCount(ctx.me.id),
    pendingDrafts(ctx),
  ]);
  const other = ctx.others[0];

  const dueItems: DueItem[] = house.due.map((d) => ({
    contributionId: d.contribution.id,
    name: d.contribution.name,
    source: d.contribution.source,
    period: d.period,
    label: d.label,
    overdue: d.overdue,
    totalCents: d.totalCents,
    defaultReceiverId: d.contribution.defaultReceiverId,
    lines: d.lines.map((l) => ({ id: l.id, label: l.label, amountCents: l.amountCents })),
  }));
  const overdueServices = house.services.filter((s) => s.status.overdue.length > 0);
  const hasPending = dueItems.length > 0 || overdueServices.length > 0 || house.shortfalls.length > 0 || drafts.length > 0;

  return (
    <Screen
      title={`Hola, ${ctx.me.name}`}
      action={
        <div className="-mr-2 flex items-center">
        <CalculatorButton className="text-ink-2" />
        <Link href="/avisos" className="relative flex size-10 items-center justify-center rounded-full active:bg-press" aria-label={`Avisos${unread ? ` (${unread} sin leer)` : ""}`}>
          <Bell size={22} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[11px] font-800 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        </div>
      }
    >
      {other && <BalanceHero me={ctx.me} other={other} balance={house.balances[0]} />}
      {other && !other.userId && (
        <div className="mt-3">
          <Notice>
            {other.name} todavía no tiene cuenta.{" "}
            <Link href="/yo/invitar" className="font-700 text-ink underline underline-offset-4">
              Mándale la invitación
            </Link>
          </Notice>
        </div>
      )}

      {house.rent && (
        <Group title="Este mes">
          <RentMini rent={house.rent} />
        </Group>
      )}

      {hasPending && (
        <Group title="Pendientes">
          {drafts.length > 0 && (
            <Row
              href="/nuevo/pendientes"
              icon={<span className="text-[22px]">📥</span>}
              title={drafts.length === 1 ? "1 captura por confirmar" : `${drafts.length} capturas por confirmar`}
              subtitle="Llegaron desde el atajo del iPhone"
            />
          )}
          {house.shortfalls.map((s) => (
            <Row
              key={s.pot.id}
              href={`/casa/bolsas/${s.pot.id}`}
              icon={<span className="text-[22px]">{s.pot.emoji}</span>}
              title={`Faltan ${formatCents(s.missingCents)} en ${s.pot.name}`}
              subtitle="Elige cómo cubrirlo"
              valueTone="bad"
            />
          ))}
          {dueItems.map((d) => (
            <ContributionCheck
              key={`${d.contributionId}-${d.period}`}
              item={d}
              members={ctx.members.map((m) => ({ id: m.id, name: m.name }))}
              meId={ctx.me.id}
              today={house.today}
            />
          ))}
          {overdueServices.map((s) => (
            <Row
              key={s.service.id}
              href="/casa/servicios"
              icon={<span className="text-[22px]">{s.service.emoji}</span>}
              title={`${s.service.name} sin pagar`}
              subtitle={
                s.service.accumulable
                  ? `Debes ${s.status.pending.map((p) => periodLabel(p).split(" ")[0]).join(" y ")}. Acuérdate de pagarlos juntos.`
                  : `Atrasado: ${s.status.overdue.map((p) => periodLabel(p)).join(", ")}`
              }
            />
          ))}
        </Group>
      )}

      <Group title="Bolsas" action={<Link href="/casa" className="text-[14px] font-600 text-ink-2">Ver todo</Link>}>
        {house.pots.length ? (
          house.pots.map((p) => <PotRow key={p.id} pot={p} members={ctx.members} />)
        ) : (
          <Empty title="Sin bolsas">Créalas en Ajustes.</Empty>
        )}
      </Group>

      <Group
        title="Últimos movimientos"
        action={<Link href="/movimientos" className="text-[14px] font-600 text-ink-2">Ver todo</Link>}
      >
        {events.length ? (
          events.map((e) => <EventItem key={e.id} event={e} members={ctx.members} />)
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-[16px] font-600">Todavía no hay movimientos</p>
            <p className="mt-1 mb-4 text-[14px] text-ink-2">Sube la captura de un pago para empezar.</p>
            <LinkButton href="/nuevo">Registrar un gasto</LinkButton>
          </div>
        )}
      </Group>
    </Screen>
  );
}
