import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { getUser, loadContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { HouseholdForm } from "@/components/config/HouseholdForm";
import { PotsWizardForm } from "@/components/config/PotsWizardForm";
import { RentForm } from "@/components/config/RentForm";
import { ContributionForm } from "@/components/config/ContributionForm";
import { ServiceForm } from "@/components/config/ServiceForm";
import { ShareButton } from "@/components/ShareButton";
import { buttonClass } from "@/components/ui";
import { deleteContribution, deleteService, finishSetup, wizardNext } from "@/lib/actions/config";
import { SUGGESTED_SERVICES } from "@/lib/defaults";
import { formatCents } from "@/lib/money";
import { appOrigin } from "@/lib/origin";
import { cx } from "@/lib/cx";

export const metadata = { title: "Configurar la casa" };

const STEPS = ["La casa", "Bolsas", "Arriendo", "Aportes", "Servicios", "Invitar"];

const INTRO: Record<number, { title: string; text: string }> = {
  1: { title: "Empecemos por la casa", text: "Quiénes viven y con qué color se va a reconocer a cada uno en la app." },
  2: {
    title: "Bolsas",
    text: "Una bolsa es plata guardada para algo: entra plata, sale plata y lo que sobra se acumula. La app siempre sabe quién la tiene.",
  },
  3: { title: "Arriendo", text: "Cuánto es, cuánto pone cada uno y quién le paga al dueño." },
  4: {
    title: "Aportes",
    text: "Plata que llega de fuera cada semana o cada mes: lo que da la familia, lo que pagan por el garaje, etc. Cada vez que llegue la marcan como recibida.",
  },
  5: {
    title: "Servicios",
    text: "Luz, agua, internet… El monto cambia cada mes: se registra lo que llegó al subir la captura del pago.",
  },
  6: {
    title: "Todo listo",
    text: "Mándale el enlace a la otra persona para que cree su cuenta. Todo lo que configuraste se puede cambiar después en Ajustes.",
  },
};

export default async function BienvenidaPage({ searchParams }: PageProps<"/bienvenida">) {
  const user = await getUser();
  if (!user) redirect("/login");
  const ctx = await loadContext();
  const sp = await searchParams;
  if (ctx?.household.setupDone && !sp.paso) redirect("/");
  const maxStep = ctx ? Math.min(ctx.household.setupStep, 6) : 1;
  const step = Math.min(Math.max(Number(sp.paso) || maxStep, 1), maxStep);

  const pots = ctx
    ? await db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id), orderBy: asc(schema.pots.sortOrder) })
    : [];
  const members = ctx?.members.map((m) => ({ id: m.id, name: m.name })) ?? [];

  let body: React.ReactNode = null;
  if (step === 1 || !ctx) {
    body = (
      <HouseholdForm
        wizard
        defaults={
          ctx
            ? {
                name: ctx.household.name,
                myName: ctx.me.name,
                myColor: ctx.me.color,
                otherName: ctx.others[0]?.name ?? "",
                otherColor: ctx.others[0]?.color ?? "tangerine",
              }
            : undefined
        }
      />
    );
  } else if (step === 2) {
    body = <PotsWizardForm existingKinds={pots.map((p) => p.kind)} existingNames={pots.map((p) => p.name)} />;
  } else if (step === 3) {
    const rent = await db.query.rentConfig.findFirst({ where: eq(schema.rentConfig.householdId, ctx.household.id) });
    const shares = await db.query.rentShares.findMany({ where: eq(schema.rentShares.householdId, ctx.household.id) });
    body = (
      <RentForm
        wizard
        members={members}
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
    );
  } else if (step === 4) {
    const list = await db.query.contributions.findMany({
      where: eq(schema.contributions.householdId, ctx.household.id),
      orderBy: asc(schema.contributions.createdAt),
    });
    const lines = list.length
      ? await db.query.contributionLines.findMany({
          where: inArray(schema.contributionLines.contributionId, list.map((c) => c.id)),
        })
      : [];
    body = (
      <>
        {list.length > 0 && (
          <div className="mb-5 divide-y divide-line overflow-hidden rounded-2xl bg-sheet">
            {list.map((c) => {
              const ls = lines.filter((l) => l.contributionId === c.id);
              const total = ls.reduce((a, l) => a + l.amountCents, 0);
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-600">{c.name}</p>
                    <p className="text-[13px] text-ink-2">
                      {c.source} · {c.frequency === "weekly" ? "cada semana" : "cada mes"} · {ls.map((l) => l.label).join(", ")}
                    </p>
                  </div>
                  <span className="amount">{formatCents(total)}</span>
                  <form action={deleteContribution}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="flex size-9 items-center justify-center rounded-full text-ink-3 active:bg-press" aria-label={`Quitar ${c.name}`}>
                      <Trash2 size={17} />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
        <p className="mb-3 px-1 text-[17px] font-700">{list.length ? "Agregar otro aporte" : "Agregar un aporte"}</p>
        <ContributionForm key={list.length} wizard members={members} pots={pots} />
        <form action={wizardNext} className="mt-4">
          <input type="hidden" name="step" value="5" />
          <button className={cx(buttonClass(list.length ? "primary" : "ghost"), "w-full")}>
            {list.length ? "Continuar" : "Saltar por ahora"}
          </button>
        </form>
      </>
    );
  } else if (step === 5) {
    const list = await db.query.services.findMany({
      where: eq(schema.services.householdId, ctx.household.id),
      orderBy: asc(schema.services.createdAt),
    });
    const suggestions = SUGGESTED_SERVICES.filter((s) => !list.some((l) => l.name.toLowerCase() === s.name.toLowerCase()));
    const picked = suggestions.find((s) => s.name === sp.sugerencia) ?? suggestions[0];
    body = (
      <>
        {list.length > 0 && (
          <div className="mb-5 divide-y divide-line overflow-hidden rounded-2xl bg-sheet">
            {list.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-[20px]">{s.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-600">{s.name}</p>
                  <p className="text-[13px] text-ink-2">
                    {pots.find((p) => p.id === s.potId)?.name}
                    {s.accumulable ? " · se puede acumular" : ""}
                  </p>
                </div>
                <form action={deleteService}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="flex size-9 items-center justify-center rounded-full text-ink-3 active:bg-press" aria-label={`Quitar ${s.name}`}>
                    <Trash2 size={17} />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Link
                key={s.name}
                href={`/bienvenida?paso=5&sugerencia=${encodeURIComponent(s.name)}`}
                className={cx(
                  "rounded-full px-3 py-1.5 text-[14px] font-600",
                  picked?.name === s.name ? "bg-ink text-sheet" : "bg-sheet text-ink",
                )}
              >
                {s.emoji} {s.name}
              </Link>
            ))}
          </div>
        )}
        <div className="rounded-2xl bg-sheet p-4">
          <ServiceForm key={`${list.length}-${picked?.name}`} wizard pots={pots} suggestion={picked} />
        </div>
        <form action={wizardNext} className="mt-4">
          <input type="hidden" name="step" value="6" />
          <button className={cx(buttonClass(list.length ? "primary" : "ghost"), "w-full")}>
            {list.length ? "Continuar" : "Saltar por ahora"}
          </button>
        </form>
      </>
    );
  } else {
    const origin = await appOrigin();
    const other = ctx.others.find((m) => !m.userId);
    const url = `${origin}/unirse/${ctx.household.inviteCode}`;
    body = (
      <div className="space-y-4">
        {other ? (
          <div className="rounded-2xl bg-sheet p-4">
            <p className="text-[15px] text-ink-2">Enlace para {other.name}:</p>
            <p className="mt-2 break-all rounded-xl bg-paper px-3.5 py-3 text-[14px]">{url}</p>
            <div className="mt-4">
              <ShareButton url={url} text={`Únete a «${ctx.household.name}» para llevar las cuentas de la casa`} />
            </div>
          </div>
        ) : (
          <p className="rounded-2xl bg-sheet p-4 text-[15px]">Todos ya tienen cuenta.</p>
        )}
        <form action={finishSetup}>
          <button className={cx(buttonClass("secondary"), "w-full")}>Ir a la app</button>
        </form>
      </div>
    );
  }

  const intro = INTRO[step];
  return (
    <main className="mx-auto w-full max-w-lg px-4 pt-safe pb-16">
      <nav className="flex gap-1.5 pt-5" aria-label="Pasos">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const reachable = n <= maxStep;
          const cls = cx("h-1.5 flex-1 rounded-full", n <= step ? "bg-ink" : "bg-line");
          return reachable ? (
            <Link key={s} href={`/bienvenida?paso=${n}`} className={cls} aria-label={`Paso ${n}: ${s}`} aria-current={n === step ? "step" : undefined} />
          ) : (
            <span key={s} className={cls} aria-hidden />
          );
        })}
      </nav>
      <p className="mt-4 text-[14px] font-600 text-ink-3">
        Paso {step} de {STEPS.length}
      </p>
      <h1 className="mt-1 text-[30px] leading-[1.1] font-800 tracking-[-0.025em]">{intro.title}</h1>
      <p className="mt-2 mb-6 text-[15px] leading-snug text-ink-2">{intro.text}</p>
      {body}
    </main>
  );
}
