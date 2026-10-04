import { asc, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ContributionForm } from "@/components/config/ContributionForm";
import { Screen } from "@/components/ui";

export default async function NuevoAportePage() {
  const ctx = await requireContext();
  const pots = await db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id), orderBy: asc(schema.pots.sortOrder) });
  return (
    <Screen title="Nuevo aporte" back="/yo/ajustes/aportes">
      <ContributionForm back="/yo/ajustes/aportes" members={ctx.members.map((m) => ({ id: m.id, name: m.name }))} pots={pots} />
    </Screen>
  );
}
