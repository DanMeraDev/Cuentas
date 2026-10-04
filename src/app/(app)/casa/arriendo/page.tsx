import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { loadHouse } from "@/lib/queries";
import { ActionButton, ContributionCheck } from "@/components/actions";
import { Group, LinkButton, MemberDot, Notice, Pill, Row, Screen } from "@/components/ui";
import { rentDeliver, rentSetAside } from "@/lib/actions/money";
import { formatCents } from "@/lib/money";
import { formatDay } from "@/lib/periods";

export const metadata = { title: "Arriendo" };

const SHARE_LABEL = { pending: "Pendiente", set_aside: "Ya la tiene", delivered: "Entregada" } as const;
const SHARE_TONE = { pending: "warn", set_aside: "good", delivered: "good" } as const;

export default async function ArriendoPage() {
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const rent = house.rent;
  if (!rent) {
    return (
      <Screen title="Arriendo" back="/casa">
        <Notice>El arriendo no está configurado.</Notice>
        <div className="mt-4">
          <LinkButton href="/yo/ajustes/arriendo">Configurar arriendo</LinkButton>
        </div>
      </Screen>
    );
  }
  const name = (id: string | null) => ctx.members.find((m) => m.id === id)?.name ?? "—";
  const member = (id: string) => ctx.members.find((m) => m.id === id)!;
  const myState = rent.summary.shareStates[ctx.me.id];
  const myShare = rent.shares[ctx.me.id] ?? 0;
  const rentPot = house.pots.find((p) => p.id === rent.potId);
  const myHolding = rentPot?.byMember[ctx.me.id] ?? 0;
  const payerId = rent.payment?.paidBy ?? rent.payerId;
  const iAmPayer = payerId === ctx.me.id;
  const canDeliver = !iAmPayer && payerId && myState !== "delivered" && (myHolding > 0 || myState === "pending");
  const deliverAmount = myHolding + (myState === "pending" ? myShare : 0);

  return (
    <Screen title={`Arriendo de ${rent.periodLabel.split(" ")[0]}`} back="/casa">
      <div className="rounded-[28px] bg-sheet p-5">
        <p className="text-[14px] font-600 text-ink-3">
          {formatCents(rent.totalCents)} · se paga el día {rent.dueDay}
          {rent.payerId ? ` · lo paga ${name(rent.payerId)}` : ""}
        </p>
        <p className="mt-2 text-[22px] leading-[1.2] font-800 tracking-[-0.02em]">{rent.summary.headline}</p>
        {rent.summary.missing.length > 0 && !rent.payment && (
          <p className="mt-2 text-[14px] text-ink-2">Falta marcar: {rent.summary.missing.join(", ")}.</p>
        )}
        {rent.summary.configuredCents !== rent.totalCents && (
          <p className="mt-2 text-[13px] text-warn">
            Las partes y los aportes suman {formatCents(rent.summary.configuredCents)}, pero el arriendo es{" "}
            {formatCents(rent.totalCents)}. Revisa la configuración.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {myState === "pending" && !rent.payment && (
            <ActionButton action={rentSetAside} fields={{}}>
              Ya tengo mi parte ({formatCents(myShare)})
            </ActionButton>
          )}
          {canDeliver && (
            <ActionButton action={rentDeliver} fields={{}} variant={myState === "pending" ? "secondary" : "primary"}>
              {rent.payment ? "Le pagué" : "Le entregué"} {formatCents(deliverAmount)} a {name(payerId)}
            </ActionButton>
          )}
          {!rent.payment && (
            <LinkButton href="/casa/arriendo/pagar" variant={iAmPayer && myState !== "pending" ? "primary" : "secondary"} className="w-full">
              Registrar pago al dueño
            </LinkButton>
          )}
          {rent.payment && (
            <Link href={`/movimientos/${rent.payment.eventId}`} className="block text-center text-[14px] font-600 text-ink-2 underline underline-offset-4">
              Pagado por {name(rent.payment.paidBy)} el {formatDay(rent.payment.paidOn)} · ver comprobante
            </Link>
          )}
        </div>
      </div>

      <Group title="Partes de cada uno">
        {Object.entries(rent.shares).map(([memberId, amount]) => {
          const state = rent.summary.shareStates[memberId] ?? "pending";
          const mark = rent.marks.find((m) => m.memberId === memberId && m.kind === state);
          return (
            <Row
              key={memberId}
              icon={<MemberDot color={member(memberId).color} size={14} />}
              title={memberId === ctx.me.id ? `Tú (${member(memberId).name})` : member(memberId).name}
              subtitle={mark ? `${SHARE_LABEL[state]} desde el ${formatDay(mark.markedOn)}` : formatCents(amount)}
              value={<Pill tone={SHARE_TONE[state]}>{SHARE_LABEL[state]}</Pill>}
            />
          );
        })}
      </Group>

      {rent.lines.length > 0 && (
        <Group title="Aportes al arriendo">
          {rent.lines.map((l) => {
            const due = house.due.find((d) => d.contribution.id === l.contributionId && d.period === rent.period);
            if (due && !l.receivedBy && !l.skipped) {
              return (
                <ContributionCheck
                  key={l.key}
                  item={{
                    contributionId: due.contribution.id,
                    name: due.contribution.name,
                    source: due.contribution.source,
                    period: due.period,
                    label: `${formatCents(l.amountCents)} · sin marcar`,
                    overdue: false,
                    totalCents: due.totalCents,
                    defaultReceiverId: due.contribution.defaultReceiverId,
                    lines: due.lines.map((x) => ({ id: x.id, label: x.label, amountCents: x.amountCents })),
                  }}
                  members={ctx.members.map((m) => ({ id: m.id, name: m.name }))}
                  meId={ctx.me.id}
                  today={house.today}
                />
              );
            }
            return (
              <Row
                key={l.key}
                href={l.eventId ? `/movimientos/${l.eventId}` : undefined}
                icon={<span className="text-[20px]">💵</span>}
                title={l.label}
                subtitle={
                  l.skipped ? "Este mes no llegó" : `Lo recibió ${name(l.receivedBy)} el ${formatDay(l.receivedOn!)}`
                }
                value={formatCents(l.amountCents)}
                valueTone={l.skipped ? "muted" : undefined}
              />
            );
          })}
        </Group>
      )}

      {rentPot && (
        <Group title="¿Quién tiene la plata del arriendo?">
          {ctx.members.map((m) => {
            const v = rentPot.byMember[m.id] ?? 0;
            return (
              <Row
                key={m.id}
                icon={<MemberDot color={m.color} size={14} />}
                title={m.name}
                subtitle={v < 0 ? "Puso de su bolsillo" : v > 0 ? "La tiene guardada" : "Nada por ahora"}
                value={formatCents(Math.abs(v))}
                valueTone={v === 0 ? "muted" : undefined}
              />
            );
          })}
          {rent.summary.toDeliver.map((d) => (
            <Row
              key={d.fromId}
              icon={<span className="text-[20px]">🤝</span>}
              title={`${name(d.fromId)} le tiene que pasar ${formatCents(d.amountCents)} a ${name(d.toId)}`}
              subtitle="Antes de pagarle al dueño"
            />
          ))}
        </Group>
      )}
    </Screen>
  );
}
