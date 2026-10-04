import { requireContext } from "@/lib/auth";
import { loadHouse } from "@/lib/queries";
import { Group, LinkButton, Notice, Pill, Row, Screen } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { periodLabel } from "@/lib/periods";

export const metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const pots = house.pots.filter((p) => house.services.some((s) => s.service.potId === p.id));
  return (
    <Screen title="Servicios" back="/casa">
      {pots.map((pot) => (
        <div key={pot.id} className="mt-2">
          <Notice>
            {pot.emoji} {pot.name}: hay <strong className="amount text-ink">{formatCents(pot.totalCents)}</strong>
            {pot.committedCents > 0 && (
              <>
                , de los que {formatCents(pot.committedCents)} quedan reservados para lo pendiente. Sobrante:{" "}
                <strong className="amount text-ink">{formatCents(Math.max(0, pot.availableCents))}</strong>
              </>
            )}
            .
          </Notice>
        </div>
      ))}
      <Group>
        {house.services.map((s) => (
          <Row
            key={s.service.id}
            href={`/casa/servicios/${s.service.id}`}
            icon={<span className="text-[22px]">{s.service.emoji}</span>}
            title={s.service.name}
            subtitle={
              s.status.pending.length === 0
                ? "Al día"
                : `Sin pagar: ${s.status.pending.map((p) => periodLabel(p, { short: true })).join(", ")}${
                    s.status.estimateCents ? ` · aprox. ${formatCents(s.status.committedCents)}` : ""
                  }`
            }
            value={
              s.status.pending.length === 0 ? (
                <Pill tone="good">Al día</Pill>
              ) : s.status.overdue.length ? (
                <Pill tone={s.service.accumulable ? "warn" : "bad"}>Atrasado</Pill>
              ) : (
                <Pill>Este mes</Pill>
              )
            }
          />
        ))}
      </Group>
      {house.services.length === 0 && (
        <div className="mt-4">
          <LinkButton href="/yo/ajustes/servicios">Agregar servicios</LinkButton>
        </div>
      )}
    </Screen>
  );
}
