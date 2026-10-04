import { and, asc, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { PotEditor } from "@/components/config/PotEditor";
import { Group, Screen } from "@/components/ui";

export default async function AjustesBolsasPage() {
  const ctx = await requireContext();
  const pots = await db.query.pots.findMany({
    where: and(eq(schema.pots.householdId, ctx.household.id), eq(schema.pots.archived, false)),
    orderBy: asc(schema.pots.sortOrder),
  });
  return (
    <Screen title="Bolsas" back="/yo/ajustes">
      <Group footer="El tipo ayuda a la IA a sugerir de qué bolsa sale cada gasto.">
        {pots.map((p) => (
          <PotEditor key={p.id} pot={p} />
        ))}
      </Group>
      <Group title="Nueva bolsa">
        <PotEditor />
      </Group>
    </Screen>
  );
}
