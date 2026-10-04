import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { listEvents } from "@/lib/queries";
import { EventItem } from "@/components/house";
import { Empty, Screen } from "@/components/ui";
import { cx } from "@/lib/cx";
import { formatDay } from "@/lib/periods";

export const metadata = { title: "Movimientos" };

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "casa", label: "De la casa" },
  { key: "personales", label: "Mis personales" },
] as const;

export default async function MovimientosPage({ searchParams }: PageProps<"/movimientos">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.ver)?.key ?? "todos";
  const events = await listEvents(ctx, { filter, limit: 200 });

  // agrupar por mes
  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = e.occurredOn.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <Screen title="Movimientos">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "todos" ? "/movimientos" : `/movimientos?ver=${f.key}`}
            role="tab"
            aria-selected={filter === f.key}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-2 text-[14px] font-600",
              filter === f.key ? "bg-ink text-sheet" : "bg-sheet text-ink",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {events.length === 0 && <Empty title="No hay movimientos todavía" />}
      {[...groups.entries()].map(([month, list]) => (
        <section key={month} className="mt-6">
          <h2 className="mb-2 px-1 text-[17px] font-700 first-letter:uppercase">{formatDay(`${month}-01`, "MMMM yyyy")}</h2>
          <div className="divide-y divide-line overflow-hidden rounded-2xl bg-sheet">
            {list.map((e) => (
              <EventItem key={e.id} event={e} members={ctx.members} />
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
