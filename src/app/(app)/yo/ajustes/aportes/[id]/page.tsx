import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ContributionForm } from "@/components/config/ContributionForm";
import { Screen } from "@/components/ui";
import { deleteContribution, toggleContribution } from "@/lib/actions/config";

export default async function EditarAportePage({ params }: PageProps<"/yo/ajustes/aportes/[id]">) {
  const { id } = await params;
  const ctx = await requireContext();
  const c = await db.query.contributions.findFirst({
    where: and(eq(schema.contributions.id, id), eq(schema.contributions.householdId, ctx.household.id)),
  });
  if (!c) notFound();
  const [lines, pots] = await Promise.all([
    db.query.contributionLines.findMany({ where: eq(schema.contributionLines.contributionId, c.id), orderBy: asc(schema.contributionLines.sortOrder) }),
    db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id), orderBy: asc(schema.pots.sortOrder) }),
  ]);
  return (
    <Screen title={c.name} back="/yo/ajustes/aportes">
      <ContributionForm
        back="/yo/ajustes/aportes"
        members={ctx.members.map((m) => ({ id: m.id, name: m.name }))}
        pots={pots}
        defaults={{
          id: c.id,
          name: c.name,
          source: c.source,
          frequency: c.frequency as "weekly" | "monthly",
          defaultReceiverId: c.defaultReceiverId,
          lines: lines.map((l) => ({
            label: l.label,
            amount: (l.amountCents / 100).toFixed(2),
            dest: l.dest === "pot" ? `pot:${l.potId}` : `member:${l.memberId}`,
          })),
        }}
      />
      <form action={toggleContribution} className="mt-6">
        <input type="hidden" name="id" value={c.id} />
        <input type="hidden" name="active" value={c.active ? "0" : "1"} />
        <button className="w-full py-3 text-[15px] font-600 text-ink-2">{c.active ? "Pausar este aporte" : "Reactivar este aporte"}</button>
      </form>
      <form action={deleteContribution}>
        <input type="hidden" name="id" value={c.id} />
        <button className="w-full py-3 text-[15px] font-600 text-bad">Eliminar</button>
      </form>
    </Screen>
  );
}
