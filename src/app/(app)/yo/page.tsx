import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ActionForm, AmountInput, Field, SubmitButton, inputClass } from "@/components/forms";
import { Group, MemberAvatar, Row, Screen } from "@/components/ui";
import { addIncome } from "@/lib/actions/money";
import { signOut } from "@/lib/actions/auth";
import { categoryOf } from "@/lib/defaults";
import { formatCents } from "@/lib/money";
import { formatDay, periodLabel, todayISO } from "@/lib/periods";
import { loadHouse, personalMoney } from "@/lib/queries";
import { BankAdjust } from "@/components/BankAdjust";
import { cx } from "@/lib/cx";
import { colorVars } from "@/lib/colors";

export const metadata = { title: "Yo" };

export default async function YoPage({ searchParams }: PageProps<"/yo">) {
  const ctx = await requireContext();
  const sp = await searchParams;
  const today = todayISO(ctx.household.timezone);
  const [all, money, house] = await Promise.all([
    db.query.personalEntries.findMany({
      where: eq(schema.personalEntries.memberId, ctx.me.id),
      orderBy: [desc(schema.personalEntries.occurredOn), desc(schema.personalEntries.id)],
    }),
    personalMoney(ctx),
    loadHouse(ctx),
  ]);
  const months = [...new Set(all.map((e) => e.occurredOn.slice(0, 7)))].sort().reverse();
  const month = typeof sp.mes === "string" && months.includes(sp.mes) ? sp.mes : null;
  const entries = month ? all.filter((e) => e.occurredOn.startsWith(month)) : all;

  // Neto por categoría: una devolución del arriendo resta del arriendo y un
  // préstamo que te pagaron resta de lo que prestaste. Los ajustes de saldo van aparte.
  const net = new Map<string, number>();
  for (const e of entries) if (e.category !== "ajuste") net.set(e.category, (net.get(e.category) ?? 0) + e.amountCents);
  const adjust = entries.filter((e) => e.category === "ajuste").reduce((a, e) => a + e.amountCents, 0);
  const income = [...net.values()].filter((v) => v > 0).reduce((a, v) => a + v, 0);
  const spent = -[...net.values()].filter((v) => v < 0).reduce((a, v) => a + v, 0);
  const cats = [...net.entries()]
    .filter(([, v]) => v < 0)
    .map(([k, v]) => [k, -v] as [string, number])
    .sort((a, b) => b[1] - a[1]);
  const max = cats[0]?.[1] ?? 1;
  const c = colorVars(ctx.me.color);
  const other = ctx.others[0];
  const hasAdjust = all.some((e) => e.category === "ajuste");

  return (
    <Screen>
      <div className="flex items-center gap-3 pt-6">
        <MemberAvatar name={ctx.me.name} color={ctx.me.color} size={52} />
        <div>
          <h1 className="text-[26px] leading-tight font-800 tracking-[-0.02em]">{ctx.me.name}</h1>
          <p className="text-[14px] text-ink-2">{ctx.household.name}</p>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-[28px] bg-sheet">
        <div className="px-5 pt-5">
          <p className="text-[14px] font-600 text-ink-3">Tu plata (banco + efectivo)</p>
          <p className={cx("amount mt-1 text-[44px] leading-none", money.total < 0 && "text-bad")}>{formatCents(money.total)}</p>
        </div>
        <div className="mt-4 divide-y divide-line border-t border-line">
          <Row title="Lo tuyo" subtitle="Lo que entró menos lo que salió, desde el inicio" value={formatCents(money.own)} />
          {money.holdingRows
            .filter((r) => r.total !== 0)
            .map((r) => {
              const pot = house.pots.find((p) => p.id === r.potId);
              return (
                <Row
                  key={r.potId}
                  href={`/casa/bolsas/${r.potId}`}
                  title={r.total > 0 ? `Plata de ${pot?.name ?? "una bolsa"} que tienes` : `Pusiste por ${pot?.name ?? "una bolsa"}`}
                  subtitle={r.total > 0 ? "Es de la casa, no tuya" : "Te la tienen que devolver de la bolsa"}
                  value={`${r.total > 0 ? "+" : ""}${formatCents(r.total)}`}
                />
              );
            })}
          {money.pending !== 0 && (
            <Row
              href="/balance"
              title={money.pending > 0 ? `Plata de ${other?.name ?? "otro"} que tienes` : `${other?.name ?? "Otro"} te la tiene que pasar`}
              subtitle={money.pending > 0 ? "Gastos o aportes que todavía no le pasas" : "Gastos o aportes que todavía no te pasa"}
              value={`${money.pending > 0 ? "+" : ""}${formatCents(money.pending)}`}
            />
          )}
        </div>
        <BankAdjust hasAdjust={hasAdjust} />
      </section>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Período">
        {[null, ...months].map((m) => (
          <Link
            key={m ?? "todo"}
            href={m ? `/yo?mes=${m}` : "/yo"}
            role="tab"
            aria-selected={month === m}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-2 text-[14px] font-600",
              month === m ? "bg-ink text-sheet" : "bg-sheet text-ink",
            )}
          >
            {m ? periodLabel(m, { short: true }) : "Todo"}
          </Link>
        ))}
      </div>

      <Group
        title={month ? `Mis cuentas de ${periodLabel(month)}` : "Mis cuentas desde el inicio"}
        footer="Solo tú ves esta sección. Incluye tus gastos personales, tu parte de los compartidos y los préstamos que haces o recibes."
      >
        <div className="grid grid-cols-3 gap-2 p-4 text-center">
          <div>
            <p className="text-[13px] text-ink-3">Entró</p>
            <p className="amount text-[18px] text-good">{formatCents(income)}</p>
          </div>
          <div>
            <p className="text-[13px] text-ink-3">Salió</p>
            <p className="amount text-[18px]">{formatCents(spent)}</p>
          </div>
          <div>
            <p className="text-[13px] text-ink-3">{month ? "Diferencia" : "Neto"}</p>
            <p className={`amount text-[18px] ${income - spent < 0 ? "text-bad" : ""}`}>{formatCents(income - spent)}</p>
          </div>
        </div>
        {adjust !== 0 && (
          <Row title="🏦 Ajustes de saldo" subtitle="Plata que ya tenías o diferencias con el banco" value={`${adjust > 0 ? "+" : ""}${formatCents(adjust)}`} />
        )}
        {cats.length > 0 && (
          <div className="space-y-2.5 px-4 py-4">
            {cats.map(([key, v]) => {
              const cat = categoryOf(key);
              return (
                <div key={key}>
                  <div className="flex justify-between text-[14px]">
                    <span>
                      {cat.emoji} {cat.label}
                    </span>
                    <span className="amount">{formatCents(v)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-paper">
                    <div className="h-2 rounded-full" style={{ width: `${Math.max(4, (v / max) * 100)}%`, background: c.fg }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Group>

      <Group title="Agregar un ingreso">
        <ActionForm action={addIncome} className="space-y-3 p-4" resetOnSuccess>
          <div className="grid grid-cols-[1fr_1.3fr] gap-2">
            <AmountInput name="amount" required />
            <input name="description" placeholder="Ej. Sueldo" className={inputClass} aria-label="Descripción" />
          </div>
          <Field label="Fecha">
            <input type="date" name="occurredOn" defaultValue={today} max={today} className={inputClass} />
          </Field>
          <SubmitButton variant="secondary" className="w-full">
            Guardar ingreso
          </SubmitButton>
        </ActionForm>
      </Group>

      {entries.length > 0 && (
        <Group title={month ? `Movimientos de ${periodLabel(month).split(" ")[0]}` : "Últimos movimientos"}>
          {entries.slice(0, 40).map((e) => (
            <Row
              key={e.id}
              href={`/movimientos/${e.eventId}`}
              chevron={false}
              icon={<span className="text-[20px]">{categoryOf(e.category).emoji}</span>}
              title={e.description}
              subtitle={formatDay(e.occurredOn)}
              value={`${e.amountCents > 0 ? "+" : ""}${formatCents(e.amountCents)}`}
              valueTone={e.amountCents > 0 ? "good" : undefined}
            />
          ))}
        </Group>
      )}

      <Group title="La app">
        <Row href="/yo/ajustes" icon={<span className="text-[20px]">⚙️</span>} title="Ajustes de la casa" subtitle="Personas, bolsas, arriendo, aportes y servicios" />
        <Row href="/yo/invitar" icon={<span className="text-[20px]">✉️</span>} title="Invitar" />
        <Row href="/yo/atajo" icon={<span className="text-[20px]">📲</span>} title="Instalar en el iPhone y atajo" subtitle="Registrar desde el menú Compartir" />
        <Row href="/avisos" icon={<span className="text-[20px]">🔔</span>} title="Avisos" />
      </Group>

      <form action={signOut} className="mt-6">
        <button className="w-full py-3 text-[15px] font-600 text-bad">Cerrar sesión</button>
      </form>
    </Screen>
  );
}
