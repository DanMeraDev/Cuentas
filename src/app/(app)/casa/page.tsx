import { requireContext } from "@/lib/auth";
import { loadHouse } from "@/lib/queries";
import { PotRow, RentMini } from "@/components/house";
import { Group, Pill, Row, Screen } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { periodLabel } from "@/lib/periods";

export const metadata = { title: "Casa" };

export default async function CasaPage() {
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const dueCount = house.due.length;
  return (
    <Screen title="Casa">
      {house.rent && (
        <Group title="Arriendo">
          <RentMini rent={house.rent} />
        </Group>
      )}

      <Group title="Bolsas" footer="Toca una bolsa para ver quién tiene la plata, mover el sobrante o cubrir un faltante.">
        {house.pots.map((p) => (
          <PotRow key={p.id} pot={p} members={ctx.members} />
        ))}
      </Group>

      <Group title="Servicios">
        {house.services.length === 0 && <Row href="/yo/ajustes/servicios" title="Agregar servicios" />}
        {house.services.map((s) => (
          <Row
            key={s.service.id}
            href={`/casa/servicios/${s.service.id}`}
            icon={<span className="text-[22px]">{s.service.emoji}</span>}
            title={s.service.name}
            subtitle={
              s.status.paidCurrent
                ? `${periodLabel(house.month).split(" ")[0]} pagado`
                : s.status.overdue.length
                  ? `Debe ${s.status.pending.map((p) => periodLabel(p).split(" ")[0]).join(" y ")}`
                  : `${periodLabel(house.month).split(" ")[0]} sin pagar`
            }
            value={
              s.status.paidCurrent ? (
                <Pill tone="good">Al día</Pill>
              ) : s.status.overdue.length ? (
                <Pill tone={s.service.accumulable ? "warn" : "bad"}>{s.status.pending.length} meses</Pill>
              ) : (
                <Pill>Pendiente</Pill>
              )
            }
          />
        ))}
      </Group>

      <Group title="Aportes">
        <Row
          href="/casa/aportes"
          icon={<span className="text-[22px]">💵</span>}
          title="Aportes recibidos"
          subtitle={dueCount ? `${dueCount} por marcar` : "Todo marcado"}
          value={dueCount ? <Pill tone="warn">{dueCount}</Pill> : undefined}
        />
      </Group>

      {house.deliveries.length > 0 && (
        <Group title="Plata por entregar" footer="Alguien pagó algo de una bolsa con su plata y otra persona tiene la plata de esa bolsa.">
          {house.deliveries.map((d, i) => {
            const pot = house.pots.find((p) => p.id === d.potId);
            const from = ctx.members.find((m) => m.id === d.fromId);
            const to = ctx.members.find((m) => m.id === d.toId);
            return (
              <Row
                key={i}
                href={`/casa/bolsas/${d.potId}`}
                icon={<span className="text-[22px]">{pot?.emoji}</span>}
                title={`${from?.name} le debe entregar a ${to?.name}`}
                subtitle={pot?.name}
                value={formatCents(d.amountCents)}
              />
            );
          })}
        </Group>
      )}
    </Screen>
  );
}
