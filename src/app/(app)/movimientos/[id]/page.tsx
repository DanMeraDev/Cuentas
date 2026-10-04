import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { UndoButton } from "@/components/actions";
import { Group, MemberBadge, Notice, Row, Screen } from "@/components/ui";
import { categoryOf } from "@/lib/defaults";
import { formatCents } from "@/lib/money";
import { formatDay } from "@/lib/periods";
import { canSeeFile } from "@/lib/storage";

const KIND_LABEL: Record<string, string> = {
  contribution: "Entró del aporte",
  rent_share: "Apartó su parte",
  handover: "Entrega",
  rent_payment: "Pago al dueño",
  service: "Pago de servicio",
  expense: "Gasto",
  transfer_in: "Entró desde otra bolsa",
  transfer_out: "Salió a otra bolsa",
  shortfall: "Cubrió faltante",
};

export default async function EventoPage({ params }: PageProps<"/movimientos/[id]">) {
  const { id } = await params;
  const ctx = await requireContext();
  const event = await db.query.events.findFirst({
    where: and(eq(schema.events.id, id), eq(schema.events.householdId, ctx.household.id)),
  });
  if (!event || (event.privateTo && event.privateTo !== ctx.me.id)) notFound();

  const [moves, ledger, file] = await Promise.all([
    db.query.potMovements.findMany({ where: eq(schema.potMovements.eventId, event.id) }),
    db.query.memberLedger.findMany({ where: eq(schema.memberLedger.eventId, event.id) }),
    event.fileId ? db.query.files.findFirst({ where: eq(schema.files.id, event.fileId) }) : Promise.resolve(undefined),
  ]);
  const pots = moves.length
    ? await db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id) })
    : [];
  const member = (mid: string) => ctx.members.find((m) => m.id === mid);
  const actor = member(event.actorId);
  const cat = event.category ? categoryOf(event.category) : null;

  return (
    <Screen back="/movimientos">
      <div className="rounded-[28px] bg-sheet p-5">
        <p className="text-[14px] font-600 text-ink-3">
          {formatDay(event.occurredOn, "EEEE d 'de' MMMM yyyy")}
          {cat ? ` · ${cat.emoji} ${cat.label}` : ""}
        </p>
        <h1 className="mt-2 text-[26px] leading-[1.15] font-800 tracking-[-0.02em]">{event.title}</h1>
        {event.amountCents !== 0 && <p className="amount mt-3 text-[40px] leading-none">{formatCents(event.amountCents)}</p>}
        {event.detail && <p className="mt-3 text-[15px] text-ink-2">{event.detail}</p>}
        <div className="mt-4 flex items-center gap-2 text-[13px] text-ink-3">
          Registrado por {actor && <MemberBadge name={actor.name} color={actor.color} />}
          {event.privateTo && <span>· solo lo ves tú</span>}
        </div>
      </div>

      {file && canSeeFile(file, ctx.household.id, ctx.me.id) && (
        <Group title="Comprobante">
          <a href={`/api/archivos/${file.id}`} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/archivos/${file.id}`} alt="Comprobante" className="max-h-[480px] w-full object-contain" />
          </a>
        </Group>
      )}

      {(moves.length > 0 || ledger.length > 0) && (
        <Group title="Qué movió" footer="Así afectó este registro a las bolsas y a las cuentas entre ustedes.">
          {moves.map((m) => {
            const pot = pots.find((p) => p.id === m.potId);
            return (
              <Row
                key={m.id}
                icon={<span className="text-[20px]">{pot?.emoji}</span>}
                title={`${pot?.name}: ${KIND_LABEL[m.kind] ?? m.kind}`}
                subtitle={member(m.holderId)?.name}
                value={`${m.amountCents > 0 ? "+" : ""}${formatCents(m.amountCents)}`}
                valueTone={m.amountCents > 0 ? "good" : undefined}
              />
            );
          })}
          {ledger.map((l) => (
            <Row
              key={l.id}
              icon={<span className="text-[20px]">🤝</span>}
              title={`${member(l.debtorId)?.name} le debe a ${member(l.creditorId)?.name}`}
              subtitle={
                l.kind === "debt_payment" || l.kind === "settlement"
                  ? "Pago (descuenta lo que se debía)"
                  : l.kind === "shared_expense"
                    ? "Su parte del gasto"
                    : l.kind === "contribution_share"
                      ? "Su parte del aporte"
                      : "Préstamo"
              }
              value={formatCents(l.amountCents)}
            />
          ))}
        </Group>
      )}

      <div className="mt-6">
        {event.actorId === ctx.me.id ? (
          <UndoButton eventId={event.id} next="/movimientos" />
        ) : (
          <Notice>Solo {actor?.name} puede borrar este registro.</Notice>
        )}
      </div>
    </Screen>
  );
}
