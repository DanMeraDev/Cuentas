import { and, asc, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ServiceForm } from "@/components/config/ServiceForm";
import { Group, Screen } from "@/components/ui";
import { deleteService } from "@/lib/actions/config";

export default async function AjustesServiciosPage() {
  const ctx = await requireContext();
  const [services, pots] = await Promise.all([
    db.query.services.findMany({
      where: and(eq(schema.services.householdId, ctx.household.id), eq(schema.services.active, true)),
      orderBy: asc(schema.services.createdAt),
    }),
    db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id), orderBy: asc(schema.pots.sortOrder) }),
  ]);
  return (
    <Screen title="Servicios" back="/yo/ajustes">
      {services.map((s) => (
        <Group key={s.id}>
          <div className="p-4">
            <ServiceForm pots={pots} defaults={s} />
            <form action={deleteService} className="mt-2">
              <input type="hidden" name="id" value={s.id} />
              <button className="w-full py-2 text-[14px] font-600 text-bad">Quitar {s.name}</button>
            </form>
          </div>
        </Group>
      ))}
      <Group title="Nuevo servicio">
        <div className="p-4">
          <ServiceForm pots={pots} />
        </div>
      </Group>
    </Screen>
  );
}
