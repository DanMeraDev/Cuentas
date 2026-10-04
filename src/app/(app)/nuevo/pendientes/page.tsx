import { requireContext } from "@/lib/auth";
import { pendingDrafts } from "@/lib/queries";
import { Empty, Group, Row, Screen } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { formatDay, todayISO } from "@/lib/periods";
import type { ExtractionT } from "@/lib/ai";

export const metadata = { title: "Por confirmar" };

export default async function PendientesPage() {
  const ctx = await requireContext();
  const drafts = await pendingDrafts(ctx);
  return (
    <Screen title="Por confirmar" back="/nuevo">
      <Group footer="Capturas que mandaste con el atajo del iPhone y que todavía no tienen tipo.">
        {drafts.length ? (
          drafts.map((d) => {
            const x = d.aiResult as ExtractionT | null;
            return (
              <Row
                key={d.id}
                href={`/nuevo/${d.id}`}
                icon={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/archivos/${d.id}`} alt="" className="size-10 rounded-lg object-cover" />
                }
                title={x?.description ?? "Captura"}
                subtitle={`Subida el ${formatDay(todayISO(ctx.household.timezone, d.createdAt))}`}
                value={x?.amount != null ? formatCents(Math.round(x.amount * 100)) : undefined}
              />
            );
          })
        ) : (
          <Empty title="Nada por confirmar" />
        )}
      </Group>
    </Screen>
  );
}
