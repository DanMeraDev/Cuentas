import { and, desc, eq, gte } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ActionForm, AmountInput, Field, SubmitButton, inputClass } from "@/components/forms";
import { Group, MemberAvatar, Row, Screen } from "@/components/ui";
import { addIncome } from "@/lib/actions/money";
import { signOut } from "@/lib/actions/auth";
import { categoryOf } from "@/lib/defaults";
import { formatCents } from "@/lib/money";
import { formatDay, periodLabel, todayISO } from "@/lib/periods";
import { colorVars } from "@/lib/colors";

export const metadata = { title: "Yo" };

export default async function YoPage() {
  const ctx = await requireContext();
  const today = todayISO(ctx.household.timezone);
  const month = today.slice(0, 7);
  const entries = await db.query.personalEntries.findMany({
    where: and(eq(schema.personalEntries.memberId, ctx.me.id), gte(schema.personalEntries.occurredOn, `${month}-01`)),
    orderBy: [desc(schema.personalEntries.occurredOn)],
  });
  const income = entries.filter((e) => e.amountCents > 0).reduce((a, e) => a + e.amountCents, 0);
  const spent = -entries.filter((e) => e.amountCents < 0).reduce((a, e) => a + e.amountCents, 0);
  const byCat = new Map<string, number>();
  for (const e of entries.filter((e) => e.amountCents < 0)) byCat.set(e.category, (byCat.get(e.category) ?? 0) - e.amountCents);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const max = cats[0]?.[1] ?? 1;
  const c = colorVars(ctx.me.color);

  return (
    <Screen>
      <div className="flex items-center gap-3 pt-6">
        <MemberAvatar name={ctx.me.name} color={ctx.me.color} size={52} />
        <div>
          <h1 className="text-[26px] leading-tight font-800 tracking-[-0.02em]">{ctx.me.name}</h1>
          <p className="text-[14px] text-ink-2">{ctx.household.name}</p>
        </div>
      </div>

      <Group title={`Mis cuentas de ${periodLabel(month).split(" ")[0]}`} footer="Solo tú ves esta sección. Incluye tus gastos personales y tu parte de los compartidos.">
        <div className="grid grid-cols-3 gap-2 p-4 text-center">
          <div>
            <p className="text-[13px] text-ink-3">Entró</p>
            <p className="amount text-[18px] text-good">{formatCents(income)}</p>
          </div>
          <div>
            <p className="text-[13px] text-ink-3">Gasté</p>
            <p className="amount text-[18px]">{formatCents(spent)}</p>
          </div>
          <div>
            <p className="text-[13px] text-ink-3">Queda</p>
            <p className={`amount text-[18px] ${income - spent < 0 ? "text-bad" : ""}`}>{formatCents(income - spent)}</p>
          </div>
        </div>
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
        <Group title="Este mes">
          {entries.slice(0, 15).map((e) => (
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
