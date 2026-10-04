import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { loadHouse } from "@/lib/queries";
import { ContributionCheck } from "@/components/actions";
import { EventItem } from "@/components/house";
import { Empty, Group, Row, Screen } from "@/components/ui";

export const metadata = { title: "Aportes" };

export default async function AportesPage() {
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const history = await db.query.events.findMany({
    where: and(
      eq(schema.events.householdId, ctx.household.id),
      inArray(schema.events.type, ["contribution", "contribution_skipped"]),
    ),
    orderBy: [desc(schema.events.occurredOn), desc(schema.events.createdAt)],
    limit: 30,
  });
  const contributions = await db.query.contributions.findMany({
    where: and(eq(schema.contributions.householdId, ctx.household.id), eq(schema.contributions.active, true)),
  });
  return (
    <Screen title="Aportes" back="/casa">
      <Group title="Por marcar" footer="Al marcar uno como recibido se bloquea para los dos. Solo quien lo marcó puede deshacerlo.">
        {house.due.length ? (
          house.due.map((d) => (
            <ContributionCheck
              key={`${d.contribution.id}-${d.period}`}
              item={{
                contributionId: d.contribution.id,
                name: d.contribution.name,
                source: d.contribution.source,
                period: d.period,
                label: d.label,
                overdue: d.overdue,
                totalCents: d.totalCents,
                defaultReceiverId: d.contribution.defaultReceiverId,
                lines: d.lines.map((l) => ({ id: l.id, label: l.label, amountCents: l.amountCents })),
              }}
              members={ctx.members.map((m) => ({ id: m.id, name: m.name }))}
              meId={ctx.me.id}
              today={house.today}
            />
          ))
        ) : (
          <Empty title="Todo marcado" />
        )}
      </Group>

      <Group title="Configurados" action={<Link href="/yo/ajustes/aportes" className="text-[14px] font-600 text-ink-2">Editar</Link>}>
        {contributions.map((c) => (
          <Row
            key={c.id}
            title={c.name}
            subtitle={`${c.source} · ${c.frequency === "weekly" ? "cada semana" : "cada mes"}`}
          />
        ))}
      </Group>

      <Group title="Historial">
        {history.length ? history.map((e) => <EventItem key={e.id} event={e} members={ctx.members} />) : <Empty title="Sin registros" />}
      </Group>
    </Screen>
  );
}
