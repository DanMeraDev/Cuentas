import { asc, eq, inArray } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Group, LinkButton, Pill, Row, Screen } from "@/components/ui";
import { formatCents } from "@/lib/money";

export default async function AjustesAportesPage() {
  const ctx = await requireContext();
  const list = await db.query.contributions.findMany({
    where: eq(schema.contributions.householdId, ctx.household.id),
    orderBy: asc(schema.contributions.createdAt),
  });
  const lines = list.length
    ? await db.query.contributionLines.findMany({ where: inArray(schema.contributionLines.contributionId, list.map((c) => c.id)) })
    : [];
  return (
    <Screen title="Aportes" back="/yo/ajustes">
      <Group>
        {list.map((c) => {
          const total = lines.filter((l) => l.contributionId === c.id).reduce((a, l) => a + l.amountCents, 0);
          return (
            <Row
              key={c.id}
              href={`/yo/ajustes/aportes/${c.id}`}
              title={c.name}
              subtitle={`${c.source} · ${c.frequency === "weekly" ? "cada semana" : "cada mes"}`}
              value={c.active ? formatCents(total) : <Pill>Pausado</Pill>}
            />
          );
        })}
      </Group>
      <div className="mt-4">
        <LinkButton href="/yo/ajustes/aportes/nuevo" className="w-full">
          Agregar aporte
        </LinkButton>
      </div>
    </Screen>
  );
}
