import { asc, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { RentForm } from "@/components/config/RentForm";
import { Screen } from "@/components/ui";

export default async function AjustesArriendoPage() {
  const ctx = await requireContext();
  const [rent, shares, pots] = await Promise.all([
    db.query.rentConfig.findFirst({ where: eq(schema.rentConfig.householdId, ctx.household.id) }),
    db.query.rentShares.findMany({ where: eq(schema.rentShares.householdId, ctx.household.id) }),
    db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id), orderBy: asc(schema.pots.sortOrder) }),
  ]);
  return (
    <Screen title="Arriendo" back="/yo/ajustes">
      <RentForm
        members={ctx.members.map((m) => ({ id: m.id, name: m.name }))}
        pots={pots}
        defaults={
          rent
            ? {
                total: (rent.totalCents / 100).toFixed(2),
                potId: rent.potId,
                payerId: rent.payerId,
                dueDay: rent.dueDay,
                shares: Object.fromEntries(shares.map((s) => [s.memberId, (s.amountCents / 100).toFixed(2)])),
              }
            : undefined
        }
      />
    </Screen>
  );
}
