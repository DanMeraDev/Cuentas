import Link from "next/link";
import type { ReactNode } from "react";
import type { Member, EventRow as EventRecord } from "@/lib/db/schema";
import type { PairBalance } from "@/lib/domain/balances";
import type { PotState, RentState } from "@/lib/queries";
import { colorVars } from "@/lib/colors";
import { formatCents } from "@/lib/money";
import { formatDay } from "@/lib/periods";
import { categoryOf } from "@/lib/defaults";
import { MemberDot, Pill, Row } from "./ui";

/**
 * La balanza: una barra con los colores de los dos. Se inclina hacia quien
 * tiene que recibir plata.
 */
export function BalanceHero({
  me,
  other,
  balance,
}: {
  me: Member;
  other: Member;
  balance: PairBalance | undefined;
}) {
  const net = balance?.netCents ?? 0;
  const iOwe = balance && balance.fromId === me.id;
  const settled = net === 0;
  // desplazamiento visual: 0 = centro; ±1 = extremo (saturado en $200)
  const tilt = settled ? 0 : Math.min(1, net / 20000) * (iOwe ? -1 : 1);
  const meC = colorVars(me.color);
  const otherC = colorVars(other.color);
  const split = 50 + tilt * 35;

  let headline: ReactNode;
  if (settled) headline = <>Están a mano con {other.name}</>;
  else if (iOwe) headline = <>Le debes <span className="amount">{formatCents(net)}</span> a {other.name}</>;
  else headline = <>{other.name} te debe <span className="amount">{formatCents(net)}</span></>;

  return (
    <Link href="/balance" className="block rounded-[28px] bg-sheet px-5 pt-5 pb-4 active:bg-press">
      <p className="text-[32px] leading-[1.08] font-800 tracking-[-0.03em]">{headline}</p>
      <div className="relative mt-5 h-3 overflow-hidden rounded-full" aria-hidden>
        <div className="absolute inset-y-0 left-0 transition-[width] duration-700" style={{ width: `${split}%`, background: meC.fg }} />
        <div className="absolute inset-y-0 right-0 transition-[width] duration-700" style={{ width: `${100 - split}%`, background: otherC.fg }} />
        <div className="absolute inset-y-[-2px] left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-sheet" />
      </div>
      <div className="mt-2 flex justify-between text-[13px] font-600">
        <span style={{ color: meC.fg }}>Tú</span>
        <span className="text-ink-3">{settled ? "Sin cuentas pendientes" : "Ver el detalle"}</span>
        <span style={{ color: otherC.fg }}>{other.name}</span>
      </div>
    </Link>
  );
}

export function HolderSplit({ pot, members }: { pot: PotState; members: Member[] }) {
  const entries = members
    .map((m) => ({ m, v: pot.byMember[m.id] ?? 0 }))
    .filter((e) => e.v !== 0);
  if (!entries.length) return <span className="text-ink-3">Sin plata</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {entries.map(({ m, v }) => (
        <span key={m.id} className="flex items-baseline gap-1.5">
          <MemberDot color={m.color} size={8} />
          <span>
            {v > 0 ? (
              <>
                {m.name} tiene <span className="amount text-ink">{formatCents(v)}</span>
              </>
            ) : (
              <>
                {m.name} puso <span className="amount text-ink">{formatCents(-v)}</span> de su bolsillo
              </>
            )}
          </span>
        </span>
      ))}
    </span>
  );
}

export function PotRow({ pot, members }: { pot: PotState; members: Member[] }) {
  return (
    <Row
      href={`/casa/bolsas/${pot.id}`}
      icon={<span className="text-[22px]">{pot.emoji}</span>}
      title={pot.name}
      subtitle={<HolderSplit pot={pot} members={members} />}
      value={formatCents(pot.totalCents)}
      valueTone={pot.totalCents < 0 ? "bad" : undefined}
    />
  );
}

export function rentHeadlineTone(rent: RentState): "good" | "warn" | "muted" {
  if (rent.payment) return "good";
  return "warn";
}

export function RentMini({ rent }: { rent: RentState }) {
  return (
    <Row
      href="/casa/arriendo"
      icon={<span className="text-[22px]">🏠</span>}
      title={`Arriendo de ${rent.periodLabel.split(" ")[0]}`}
      subtitle={rent.summary.headline}
      value={rent.payment ? <Pill tone="good">Pagado</Pill> : <Pill tone="warn">Día {rent.dueDay}</Pill>}
    />
  );
}

const TYPE_ICON: Record<string, string> = {
  contribution: "💵",
  contribution_skipped: "🚫",
  rent_set_aside: "🏠",
  rent_delivered: "🤝",
  rent_paid: "🏠",
  service_payment: "🧾",
  pot_transfer: "↔️",
  handover: "🤝",
  shortfall: "🧮",
  debt: "🤝",
  debt_payment: "✅",
  settlement: "✅",
  income: "💵",
  pot_income: "💵",
  rent_adjust: "🏠",
  external_debt: "🤝",
  external_payment: "✅",
};

export function EventItem({ event, members }: { event: EventRecord; members: Member[] }) {
  const actor = members.find((m) => m.id === event.actorId);
  const icon =
    event.type === "expense" ? categoryOf(event.category).emoji : event.type === "service_payment" ? event.title.split(" ")[0] : TYPE_ICON[event.type] ?? "•";
  const title = event.type === "service_payment" ? event.title.split(" ").slice(1).join(" ") : event.title;
  const isIncome = event.type === "contribution" || event.type === "income" || event.type === "pot_income";
  return (
    <Row
      href={`/movimientos/${event.id}`}
      chevron={false}
      icon={
        <span className="relative flex size-10 items-center justify-center rounded-xl bg-paper text-[19px]">
          {icon}
          {actor && (
            <span className="absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-[var(--sheet)]">
              <MemberDot color={actor.color} size={10} />
            </span>
          )}
        </span>
      }
      title={title}
      subtitle={
        <>
          {formatDay(event.occurredOn)}
          {event.detail ? ` · ${event.detail}` : ""}
        </>
      }
      value={event.amountCents ? `${isIncome ? "+" : ""}${formatCents(event.amountCents)}` : undefined}
      valueTone={isIncome ? "good" : undefined}
    />
  );
}
