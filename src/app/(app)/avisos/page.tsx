import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Empty, Screen } from "@/components/ui";
import { markNotificationsRead } from "@/lib/actions/money";
import { formatDay, todayISO } from "@/lib/periods";
import { cx } from "@/lib/cx";

export const metadata = { title: "Avisos" };

export default async function AvisosPage() {
  const ctx = await requireContext();
  const list = await db.query.notifications.findMany({
    where: eq(schema.notifications.memberId, ctx.me.id),
    orderBy: desc(schema.notifications.createdAt),
    limit: 60,
  });
  const unread = list.some((n) => !n.readAt);
  return (
    <Screen
      title="Avisos"
      back="/"
      action={
        unread ? (
          <form action={markNotificationsRead}>
            <button className="rounded-full px-3 py-1.5 text-[14px] font-600 text-ink-2 active:bg-press">Marcar como leídos</button>
          </form>
        ) : undefined
      }
    >
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-sheet">
        {list.length === 0 && <Empty title="No tienes avisos" />}
        {list.map((n) => {
          const body = (
            <div className={cx("flex gap-3 px-4 py-3", !n.readAt && "bg-[color-mix(in_srgb,var(--m-cobalt)_6%,transparent)]")}>
              <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-[var(--m-cobalt)]")} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-700">{n.title}</p>
                {n.body && <p className="mt-0.5 text-[14px] text-ink-2">{n.body}</p>}
                <p className="mt-1 text-[12px] text-ink-3">{formatDay(todayISO(ctx.household.timezone, n.createdAt), "d MMM")} · {n.createdAt.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", timeZone: ctx.household.timezone })}</p>
              </div>
            </div>
          );
          return n.href ? (
            <Link key={n.id} href={n.href} className="block active:bg-press">
              {body}
            </Link>
          ) : (
            <div key={n.id}>{body}</div>
          );
        })}
      </div>
    </Screen>
  );
}
