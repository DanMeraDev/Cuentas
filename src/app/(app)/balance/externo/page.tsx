import { requireContext } from "@/lib/auth";
import { loadHouse } from "@/lib/queries";
import { ExternalDebtForm } from "@/components/ExternalDebtForm";
import { Screen } from "@/components/ui";

export const metadata = { title: "Préstamo con alguien de fuera" };

export default async function ExternoPage({ searchParams }: PageProps<"/balance/externo">) {
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  const sp = await searchParams;
  return (
    <Screen title="Con alguien de fuera" back="/balance/nueva">
      <ExternalDebtForm
        members={ctx.members.map((m) => ({ id: m.id, name: m.name }))}
        meId={ctx.me.id}
        pots={house.pots.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, kind: p.kind, totalCents: p.totalCents }))}
        today={house.today}
        fileId={typeof sp.archivo === "string" ? sp.archivo : null}
      />
    </Screen>
  );
}
