"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type Tx } from "@/lib/db";
import { actionContext, type AppContext } from "@/lib/auth";
import {
  createEvent,
  currentHoldings,
  notify,
  owe,
  pendingRentShares,
  personal,
  potMove,
  transferBetweenPots,
  type Ctx,
} from "@/lib/ledger";
import { allocatePayment, pairBalance, potDeliveries, takeFromHolders } from "@/lib/domain/balances";
import { rentSummary, setAsideNotice } from "@/lib/domain/rent";
import { loadHouse, personalMoney } from "@/lib/queries";
import { formatCents, parseAmountToCents, splitEvenly } from "@/lib/money";
import { formatDay, monthKey, periodLabel, todayISO } from "@/lib/periods";
import { CATEGORIES } from "@/lib/defaults";
import { recordExpense } from "@/lib/expense";
import { attempt, fail, ok, UserError, type ActionResult } from "./result";

// ---------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function amountOf(form: FormData, key = "amount", label = "el monto"): number {
  const c = parseAmountToCents(str(form, key));
  if (c === null || c <= 0) throw new UserError(`Revisa ${label}.`);
  return c;
}

function dateOf(form: FormData, ctx: AppContext, key = "occurredOn"): string {
  const v = str(form, key);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return todayISO(ctx.household.timezone);
}

function memberOf(ctx: AppContext, id: string, label = "la persona") {
  const m = ctx.members.find((m) => m.id === id);
  if (!m) throw new UserError(`Elige ${label}.`);
  return m;
}

function nameOf(ctx: AppContext, id: string | null | undefined) {
  if (id === ctx.me.id) return "ti";
  return ctx.members.find((m) => m.id === id)?.name ?? "alguien";
}

async function potOf(ctx: AppContext, id: string) {
  const pot = await db.query.pots.findFirst({
    where: and(eq(schema.pots.id, id), eq(schema.pots.householdId, ctx.household.id)),
  });
  if (!pot) throw new UserError("Elige una bolsa.");
  return pot;
}

async function fileOf(ctx: AppContext, form: FormData): Promise<string | null> {
  const id = str(form, "fileId");
  if (!id) return null;
  const f = await db.query.files.findFirst({
    where: and(eq(schema.files.id, id), eq(schema.files.householdId, ctx.household.id)),
  });
  return f ? f.id : null;
}

function others(ctx: AppContext) {
  return ctx.others.filter((m) => m.userId).map((m) => m.id);
}

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

function done(message: string, goTo?: string | null): ActionResult {
  revalidatePath("/", "layout");
  if (goTo) redirect(goTo);
  return ok(message);
}

function nextUrl(form: FormData): string | null {
  const v = str(form, "next");
  return v.startsWith("/") ? v : null;
}

// ---------------------------------------------------------------------------
// Aportes: marcar como recibido (check bloqueable)
// ---------------------------------------------------------------------------

export async function markContribution(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const contribution = await db.query.contributions.findFirst({
      where: and(eq(schema.contributions.id, str(form, "contributionId")), eq(schema.contributions.householdId, ctx.household.id)),
    });
    if (!contribution) return fail("Aporte no encontrado.");
    const period = str(form, "period");
    if (!/^\d{4}-(\d{2}|W\d{2})$/.test(period)) return fail("Período inválido.");
    const skipped = str(form, "status") === "skipped";
    const receivedBy = skipped ? null : memberOf(ctx, str(form, "receivedBy"), "quién lo recibió").id;
    const occurredOn = dateOf(form, ctx);

    const existing = await db.query.contributionReceipts.findFirst({
      where: and(eq(schema.contributionReceipts.contributionId, contribution.id), eq(schema.contributionReceipts.period, period)),
    });
    if (existing) return fail(`Ya lo marcó ${nameOf(ctx, existing.markedBy)} el ${formatDay(existing.receivedOn)}.`);

    const lines = await db.query.contributionLines.findMany({
      where: eq(schema.contributionLines.contributionId, contribution.id),
      orderBy: asc(schema.contributionLines.sortOrder),
    });
    const actual = lines.map((l) => {
      const override = parseAmountToCents(str(form, `line_${l.id}`));
      return { ...l, amountCents: override !== null && override >= 0 ? override : l.amountCents };
    });
    const total = actual.reduce((a, l) => a + l.amountCents, 0);

    try {
      await db.transaction(async (tx) => {
        const eventId = await createEvent(tx, {
          householdId: ctx.household.id,
          type: skipped ? "contribution_skipped" : "contribution",
          actorId: ctx.me.id,
          occurredOn,
          amountCents: skipped ? 0 : total,
          title: skipped ? `${contribution.name}: no llegó` : `${contribution.name} recibido`,
          detail: `${periodLabel(period)}${receivedBy ? ` · lo recibió ${ctx.members.find((m) => m.id === receivedBy)?.name}` : ""}`,
          category: "ingreso",
          data: {
            contributionId: contribution.id,
            period,
            receivedBy,
            lines: actual.map((l) => ({ label: l.label, amountCents: l.amountCents, dest: l.dest, potId: l.potId, memberId: l.memberId })),
          },
        });
        await tx.insert(schema.contributionReceipts).values({
          householdId: ctx.household.id,
          eventId,
          contributionId: contribution.id,
          period,
          status: skipped ? "skipped" : "received",
          receivedBy,
          markedBy: ctx.me.id,
          receivedOn: occurredOn,
        });
        if (skipped || !receivedBy) return;
        const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
        for (const l of actual) {
          if (l.dest === "pot" && l.potId) {
            await potMove(tx, c, l.potId, receivedBy, l.amountCents, "contribution");
          } else if (l.dest === "member" && l.memberId) {
            await personal(tx, c, l.memberId, l.amountCents, "ingreso", `${contribution.name}: ${l.label}`);
            await owe(tx, c, receivedBy, l.memberId, l.amountCents, "contribution_share");
          }
        }
        const receiver = ctx.members.find((m) => m.id === receivedBy)!;
        await notify(
          tx,
          ctx.household.id,
          others(ctx),
          skipped ? `${contribution.name}: no llegó` : `${contribution.name} recibido`,
          `${ctx.me.name} lo marcó. Lo tiene ${receiver.id === ctx.me.id ? ctx.me.name : receiver.name} (${formatCents(total)}).`,
          "/casa",
        );
      });
    } catch (e) {
      if (isUniqueViolation(e)) return fail("Alguien lo acaba de marcar. Recarga la página.");
      throw e;
    }
    return done(skipped ? "Marcado como no recibido." : "Aporte registrado.", nextUrl(form));
  });
}

// ---------------------------------------------------------------------------
// Deshacer: borra el evento y todo lo que cuelga de él
// ---------------------------------------------------------------------------

export async function undoEvent(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const event = await db.query.events.findFirst({
      where: and(eq(schema.events.id, str(form, "eventId")), eq(schema.events.householdId, ctx.household.id)),
    });
    if (!event) return fail("Ese registro ya no existe.");
    if (event.actorId !== ctx.me.id) {
      return fail(`Solo ${nameOf(ctx, event.actorId)} puede deshacer lo que registró.`);
    }
    await db.transaction(async (tx) => {
      if (event.fileId) {
        await tx.update(schema.files).set({ draftStatus: "none", privateTo: null }).where(eq(schema.files.id, event.fileId));
      }
      await tx.delete(schema.events).where(eq(schema.events.id, event.id));
      if (!event.privateTo) {
        await notify(tx, ctx.household.id, others(ctx), `${ctx.me.name} borró un registro`, event.title, "/movimientos");
      }
    });
    return done("Registro borrado.", nextUrl(form));
  });
}

// ---------------------------------------------------------------------------
// Arriendo
// ---------------------------------------------------------------------------

async function rentContext(ctx: AppContext) {
  const rent = await db.query.rentConfig.findFirst({ where: eq(schema.rentConfig.householdId, ctx.household.id) });
  if (!rent?.active) throw new UserError("El arriendo no está configurado.");
  const shares = await db.query.rentShares.findMany({ where: eq(schema.rentShares.householdId, ctx.household.id) });
  return { rent, shares: Object.fromEntries(shares.map((s) => [s.memberId, s.amountCents])) as Record<string, number> };
}

async function setAside(tx: Tx, c: Ctx, period: string, memberId: string, potId: string, amount: number) {
  await potMove(tx, c, potId, memberId, amount, "rent_share");
  await tx.insert(schema.rentMarks).values({
    householdId: c.householdId,
    eventId: c.eventId,
    period,
    memberId,
    kind: "set_aside",
    amountCents: amount,
    markedOn: c.occurredOn,
  });
  await personal(tx, c, memberId, -amount, "arriendo", `Parte del arriendo de ${periodLabel(period)}`);
}

export async function rentSetAside(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const { rent, shares } = await rentContext(ctx);
    const period = monthKey(todayISO(ctx.household.timezone));
    const share = shares[ctx.me.id];
    if (!share) return fail("No tienes una parte del arriendo configurada.");
    const occurredOn = todayISO(ctx.household.timezone);
    try {
      await db.transaction(async (tx) => {
        const eventId = await createEvent(tx, {
          householdId: ctx.household.id,
          type: "rent_set_aside",
          actorId: ctx.me.id,
          occurredOn,
          amountCents: share,
          title: "Ya tengo mi parte del arriendo",
          detail: periodLabel(period),
          category: "arriendo",
          data: { period },
        });
        await setAside(tx, { householdId: ctx.household.id, eventId, occurredOn }, period, ctx.me.id, rent.potId, share);
      });
    } catch (e) {
      if (isUniqueViolation(e)) return fail("Ya marcaste tu parte este mes.");
      throw e;
    }
    // aviso con el estado actualizado
    const house = await loadHouse(ctx);
    if (house.rent) {
      await db.transaction(async (tx) => {
        for (const o of ctx.others.filter((m) => m.userId)) {
          const summary = rentSummary({
            viewerId: o.id,
            members: ctx.members.map((m) => ({ id: m.id, name: m.name })),
            shares,
            payerId: rent.payerId,
            totalCents: rent.totalCents,
            lines: house.rent!.lines,
            marks: [...house.rent!.marks, { memberId: ctx.me.id, kind: "set_aside", eventId: "", markedOn: occurredOn, amountCents: share }],
            payment: house.rent!.payment,
            holdings: {},
          });
          await notify(tx, ctx.household.id, [o.id], "Arriendo", setAsideNotice(ctx.me.name, o.id, summary), "/casa/arriendo");
        }
      });
    }
    return done("Listo: tu parte quedó registrada.");
  });
}

export async function rentDeliver(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const { rent, shares } = await rentContext(ctx);
    const period = monthKey(todayISO(ctx.household.timezone));
    const occurredOn = todayISO(ctx.household.timezone);
    const payment = await db.query.rentPayments.findFirst({
      where: and(eq(schema.rentPayments.householdId, ctx.household.id), eq(schema.rentPayments.period, period)),
    });
    // si ya se pagó, la plata va a quien pagó; si no, a quien paga normalmente
    const payerId = payment?.paidBy ?? rent.payerId;
    if (!payerId) return fail("Configura quién le paga al dueño.");
    if (payerId === ctx.me.id) return fail("Tú eres quien paga: no tienes que entregarle la plata a nadie.");
    const payer = memberOf(ctx, payerId);
    const marks = await db.query.rentMarks.findMany({
      where: and(eq(schema.rentMarks.householdId, ctx.household.id), eq(schema.rentMarks.period, period), eq(schema.rentMarks.memberId, ctx.me.id)),
    });
    if (marks.some((m) => m.kind === "delivered")) return fail("Ya entregaste tu plata del arriendo este mes.");
    const needsSetAside = !marks.some((m) => m.kind === "set_aside") && (shares[ctx.me.id] ?? 0) > 0;

    let delivered = 0;
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "rent_delivered",
        actorId: ctx.me.id,
        occurredOn,
        title: `Le entregué la plata del arriendo a ${payer.name}`,
        detail: periodLabel(period),
        category: "arriendo",
        data: { period, to: payer.id },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      if (needsSetAside) await setAside(tx, c, period, ctx.me.id, rent.potId, shares[ctx.me.id]);
      const holdings = await currentHoldings(tx, ctx.household.id, [rent.potId]);
      delivered = holdings[rent.potId]?.[ctx.me.id] ?? 0;
      if (delivered <= 0) throw new UserError("No tienes plata del arriendo para entregar.");
      await potMove(tx, c, rent.potId, ctx.me.id, -delivered, "handover");
      await potMove(tx, c, rent.potId, payer.id, delivered, "handover");
      await tx.insert(schema.rentMarks).values({
        householdId: ctx.household.id,
        eventId,
        period,
        memberId: ctx.me.id,
        kind: "delivered",
        amountCents: delivered,
        markedOn: occurredOn,
      });
      await tx.update(schema.events).set({ amountCents: delivered }).where(eq(schema.events.id, eventId));
      await notify(tx, ctx.household.id, [payer.id], "Arriendo", `${ctx.me.name} te entregó ${formatCents(delivered)} del arriendo.`, "/casa/arriendo");
    });
    return done(`Entregaste ${formatCents(delivered)} a ${payer.name}.`);
  });
}

export async function rentPay(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const { rent, shares } = await rentContext(ctx);
    const period = monthKey(todayISO(ctx.household.timezone));
    const paidBy = memberOf(ctx, str(form, "paidBy") || ctx.me.id, "quién pagó");
    const amount = parseAmountToCents(str(form, "amount")) ?? rent.totalCents;
    const occurredOn = dateOf(form, ctx);
    const fileId = await fileOf(ctx, form);
    const marks = await db.query.rentMarks.findMany({
      where: and(eq(schema.rentMarks.householdId, ctx.household.id), eq(schema.rentMarks.period, period)),
    });
    try {
      await db.transaction(async (tx) => {
        const eventId = await createEvent(tx, {
          householdId: ctx.household.id,
          type: "rent_paid",
          actorId: ctx.me.id,
          occurredOn,
          amountCents: amount,
          title: `Arriendo de ${periodLabel(period)} pagado`,
          detail: `Pagó ${paidBy.name}`,
          category: "arriendo",
          fileId,
          data: { period, paidBy: paidBy.id },
        });
        const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
        // quien paga pone su parte de su bolsillo en ese momento si no la había apartado
        const payerShare = shares[paidBy.id] ?? 0;
        if (payerShare > 0 && !marks.some((m) => m.memberId === paidBy.id && m.kind === "set_aside")) {
          await setAside(tx, c, period, paidBy.id, rent.potId, payerShare);
        }
        await potMove(tx, c, rent.potId, paidBy.id, -amount, "rent_payment");
        await tx.insert(schema.rentPayments).values({
          householdId: ctx.household.id,
          eventId,
          period,
          paidBy: paidBy.id,
          amountCents: amount,
          paidOn: occurredOn,
        });
        await notify(tx, ctx.household.id, others(ctx), "Arriendo pagado", `${paidBy.name} pagó el arriendo de ${periodLabel(period)} (${formatCents(amount)}).`, "/casa/arriendo");
      });
    } catch (e) {
      if (isUniqueViolation(e)) return fail("El arriendo de este mes ya está registrado como pagado.");
      throw e;
    }
    return done("Arriendo registrado como pagado.", nextUrl(form));
  });
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

export async function payService(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const service = await db.query.services.findFirst({
      where: and(eq(schema.services.id, str(form, "serviceId")), eq(schema.services.householdId, ctx.household.id)),
    });
    if (!service) return fail("Elige el servicio.");
    const periods = form.getAll("periods").map(String).filter((p) => /^\d{4}-\d{2}$/.test(p)).sort();
    if (!periods.length) return fail("Marca qué mes (o meses) cubre este pago.");
    const amount = amountOf(form);
    const paidBy = memberOf(ctx, str(form, "paidBy") || ctx.me.id, "quién pagó");
    const occurredOn = dateOf(form, ctx);
    const fileId = await fileOf(ctx, form);

    const already = await db
      .select({ periods: schema.servicePayments.periods })
      .from(schema.servicePayments)
      .where(eq(schema.servicePayments.serviceId, service.id));
    const dup = periods.filter((p) => already.some((a) => a.periods.includes(p)));
    if (dup.length) return fail(`${service.name} de ${dup.map((p) => periodLabel(p)).join(", ")} ya está pagado.`);

    await db.transaction(async (tx) => {
      const label = periods.map((p) => periodLabel(p, { short: true })).join(" y ");
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "service_payment",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: `${service.emoji} ${service.name} · ${label}`,
        detail: `Pagó ${paidBy.name}`,
        category: "servicios",
        fileId,
        data: { serviceId: service.id, periods, paidBy: paidBy.id },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      await potMove(tx, c, service.potId, paidBy.id, -amount, "service");
      await tx.insert(schema.servicePayments).values({
        householdId: ctx.household.id,
        eventId,
        serviceId: service.id,
        periods,
        paidBy: paidBy.id,
        amountCents: amount,
        paidOn: occurredOn,
      });
      await notify(tx, ctx.household.id, others(ctx), `${service.name} pagado`, `${paidBy.name} pagó ${formatCents(amount)} (${label}).`, "/casa/servicios");
    });
    return done(`${service.name} registrado.`, nextUrl(form) ?? "/casa/servicios");
  });
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------

const categoryKeys = CATEGORIES.map((c) => c.key) as [string, ...string[]];

export async function createExpense(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const scope = z.enum(["personal", "shared", "pot"]).parse(str(form, "scope") || "personal");
    const amount = amountOf(form);
    const occurredOn = dateOf(form, ctx);
    const description = str(form, "description") || str(form, "merchant") || "Gasto";
    const merchant = str(form, "merchant") || null;
    const category = z.enum(categoryKeys).catch("otros").parse(str(form, "category"));
    const paidBy = scope === "personal" ? ctx.me : memberOf(ctx, str(form, "paidBy") || ctx.me.id, "quién pagó");
    const fileId = await fileOf(ctx, form);

    // reparto de gastos compartidos
    let shares: { memberId: string; amountCents: number }[] = [];
    if (scope === "shared") {
      if (str(form, "split") === "custom") {
        shares = ctx.members.map((m) => ({ memberId: m.id, amountCents: parseAmountToCents(str(form, `share_${m.id}`)) ?? 0 }));
        const sum = shares.reduce((a, s) => a + s.amountCents, 0);
        if (sum !== amount) return fail(`Las partes suman ${formatCents(sum)} y el gasto es ${formatCents(amount)}.`);
      } else {
        // si no se divide exacto, el centavo que sobra lo pone quien pagó
        const parts = splitEvenly(amount, ctx.members.length);
        const ordered = [paidBy, ...ctx.members.filter((m) => m.id !== paidBy.id)];
        shares = ordered.map((m, i) => ({ memberId: m.id, amountCents: parts[i] }));
      }
    }
    const pot = scope === "pot" ? await potOf(ctx, str(form, "potId")) : null;

    await recordExpense(ctx, { scope, amount, occurredOn, description, merchant, category, paidBy, shares, pot, fileId });
    return done("Gasto guardado.", nextUrl(form) ?? "/");
  });
}

export async function addIncome(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const amount = amountOf(form);
    const occurredOn = dateOf(form, ctx);
    const description = str(form, "description") || "Ingreso";
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "income",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: description,
        detail: "Ingreso personal",
        category: "ingreso",
        privateTo: ctx.me.id,
      });
      await personal(tx, { householdId: ctx.household.id, eventId, occurredOn }, ctx.me.id, amount, "ingreso", description);
    });
    return done("Ingreso guardado.", nextUrl(form));
  });
}

// ---------------------------------------------------------------------------
// Bolsas: mover sobrante, entregar plata, cubrir faltantes
// ---------------------------------------------------------------------------

export async function movePotMoney(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const from = await potOf(ctx, str(form, "fromPotId"));
    const to = await potOf(ctx, str(form, "toPotId"));
    if (from.id === to.id) return fail("Elige dos bolsas distintas.");
    const amount = amountOf(form);
    const house = await loadHouse(ctx);
    const state = house.pots.find((p) => p.id === from.id);
    if (!state || amount > state.totalCents) return fail(`${from.name} solo tiene ${formatCents(state?.totalCents ?? 0)}.`);
    if (amount > state.availableCents && form.get("force") !== "1") {
      return fail(
        `Ojo: de ${from.name} hay ${formatCents(state.committedCents)} reservados para servicios pendientes. Solo puedes mover ${formatCents(Math.max(0, state.availableCents))}.`,
      );
    }
    const occurredOn = todayISO(ctx.household.timezone);
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "pot_transfer",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: `${from.emoji} ${from.name} → ${to.emoji} ${to.name}`,
        detail: "Sobrante movido",
        data: { from: from.id, to: to.id },
      });
      await transferBetweenPots(tx, { householdId: ctx.household.id, eventId, occurredOn }, from.id, to.id, amount);
      await notify(tx, ctx.household.id, others(ctx), "Bolsas", `${ctx.me.name} pasó ${formatCents(amount)} de ${from.name} a ${to.name}.`, "/casa");
    });
    return done(`Pasaste ${formatCents(amount)} a ${to.name}.`, nextUrl(form));
  });
}

/** Registrar que alguien le pasó a otro plata de una bolsa. */
export async function handOver(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const pot = await potOf(ctx, str(form, "potId"));
    const from = memberOf(ctx, str(form, "fromId"));
    const to = memberOf(ctx, str(form, "toId"));
    if (from.id === to.id) return fail("Elige dos personas distintas.");
    const amount = amountOf(form);
    const occurredOn = dateOf(form, ctx);
    const fileId = await fileOf(ctx, form);
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "handover",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: `${from.name} le pasó a ${to.name} plata de ${pot.name}`,
        detail: `${pot.emoji} ${pot.name}`,
        fileId,
        data: { potId: pot.id, from: from.id, to: to.id },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      await potMove(tx, c, pot.id, from.id, -amount, "handover");
      await potMove(tx, c, pot.id, to.id, amount, "handover");
      await notify(tx, ctx.household.id, others(ctx), pot.name, `${from.name} le pasó ${formatCents(amount)} a ${to.name}.`, "/casa");
    });
    return done("Entrega registrada.", nextUrl(form));
  });
}

export async function coverShortfall(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const pot = await potOf(ctx, str(form, "potId"));
    const house = await loadHouse(ctx);
    const shortfall = house.shortfalls.find((s) => s.pot.id === pot.id);
    if (!shortfall) return fail(`A ${pot.name} no le falta plata.`);
    const missing = shortfall.missingCents;
    const mode = str(form, "mode");
    const occurredOn = todayISO(ctx.household.timezone);

    if (mode === "pot") {
      const source = await potOf(ctx, str(form, "sourcePotId"));
      const sourceState = house.pots.find((p) => p.id === source.id);
      if (!sourceState || sourceState.totalCents < missing) {
        return fail(`${source.name} solo tiene ${formatCents(sourceState?.totalCents ?? 0)}; faltan ${formatCents(missing)}.`);
      }
      // la plata se queda con quien puso de su bolsillo (saldo negativo)
      const negative = Object.entries(shortfall.pot.byMember).sort((a, b) => a[1] - b[1])[0]?.[0];
      await db.transaction(async (tx) => {
        const eventId = await createEvent(tx, {
          householdId: ctx.household.id,
          type: "shortfall",
          actorId: ctx.me.id,
          occurredOn,
          amountCents: missing,
          title: `Faltante de ${pot.name} cubierto con ${source.name}`,
          data: { potId: pot.id, mode, source: source.id },
        });
        await transferBetweenPots(tx, { householdId: ctx.household.id, eventId, occurredOn }, source.id, pot.id, missing, negative);
        await notify(tx, ctx.household.id, others(ctx), pot.name, `${ctx.me.name} cubrió los ${formatCents(missing)} que faltaban con ${source.name}.`, "/casa");
      });
      return done("Faltante cubierto.", nextUrl(form));
    }

    const parts = splitEvenly(missing, ctx.members.length);
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "shortfall",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: missing,
        title: `Faltante de ${pot.name} dividido entre todos`,
        data: { potId: pot.id, mode: "split" },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      for (const [i, m] of ctx.members.entries()) {
        await potMove(tx, c, pot.id, m.id, parts[i], "shortfall");
        await personal(tx, c, m.id, -parts[i], pot.kind === "services" ? "servicios" : pot.kind === "food" ? "super" : "casa", `Faltante de ${pot.name}`);
      }
      await notify(tx, ctx.household.id, others(ctx), pot.name, `Faltaban ${formatCents(missing)}: a cada uno le toca ${formatCents(parts[0])}.`, "/balance");
    });
    return done("Faltante dividido.", nextUrl(form));
  });
}

// ---------------------------------------------------------------------------
// Deudas
// ---------------------------------------------------------------------------

export async function createDebt(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const other = memberOf(ctx, str(form, "otherId"), "con quién");
    if (other.id === ctx.me.id) return fail("Elige a la otra persona.");
    const theyOweMe = str(form, "direction") !== "i_owe";
    const [debtorId, creditorId] = theyOweMe ? [other.id, ctx.me.id] : [ctx.me.id, other.id];
    const amount = amountOf(form);
    const description = str(form, "description") || "Préstamo";
    const occurredOn = dateOf(form, ctx);
    const fileId = await fileOf(ctx, form);
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "debt",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: description,
        detail: theyOweMe ? `${other.name} me debe` : `Le debo a ${other.name}`,
        category: "prestamo",
        fileId,
        data: { debtorId, creditorId },
      });
      const [debt] = await tx
        .insert(schema.debts)
        .values({ householdId: ctx.household.id, eventId, debtorId, creditorId, amountCents: amount, description, occurredOn })
        .returning({ id: schema.debts.id });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      await owe(tx, c, debtorId, creditorId, amount, "debt", debt.id);
      // la plata sale de quien presta y entra a quien la recibe
      await personal(tx, c, creditorId, -amount, "prestamo", `Le presté a ${memberOf(ctx, debtorId).name}: ${description}`);
      await personal(tx, c, debtorId, amount, "prestamo", `Me prestó ${memberOf(ctx, creditorId).name}: ${description}`);
      await notify(
        tx,
        ctx.household.id,
        others(ctx),
        "Nueva deuda",
        theyOweMe
          ? `${ctx.me.name} registró que le debes ${formatCents(amount)}: ${description}.`
          : `${ctx.me.name} registró que te debe ${formatCents(amount)}: ${description}.`,
        "/balance",
      );
    });
    return done("Deuda registrada.", nextUrl(form) ?? "/balance");
  });
}

export async function payDebt(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const debt = await db.query.debts.findFirst({
      where: and(eq(schema.debts.id, str(form, "debtId")), eq(schema.debts.householdId, ctx.household.id)),
    });
    if (!debt) return fail("Deuda no encontrada.");
    const paid = await db
      .select({ total: sql<number>`coalesce(sum(${schema.memberLedger.amountCents}), 0)::int` })
      .from(schema.memberLedger)
      .where(and(eq(schema.memberLedger.debtId, debt.id), eq(schema.memberLedger.kind, "debt_payment")));
    const remaining = debt.amountCents - (paid[0]?.total ?? 0);
    if (remaining <= 0) return fail("Esta deuda ya está saldada.");
    const amount = parseAmountToCents(str(form, "amount")) ?? remaining;
    if (amount <= 0) return fail("Revisa el monto.");
    if (amount > remaining) return fail(`Solo faltan ${formatCents(remaining)}.`);
    const occurredOn = dateOf(form, ctx);
    const fileId = await fileOf(ctx, form);
    const debtor = memberOf(ctx, debt.debtorId);
    const creditor = memberOf(ctx, debt.creditorId);
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "debt_payment",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: amount === remaining ? `Deuda saldada: ${debt.description}` : `Abono: ${debt.description}`,
        detail: `${debtor.name} le pagó a ${creditor.name}`,
        category: "prestamo",
        fileId,
        data: { debtId: debt.id },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      await owe(tx, c, debt.creditorId, debt.debtorId, amount, "debt_payment", debt.id);
      await personal(tx, c, debt.debtorId, -amount, "prestamo", `Le pagué a ${creditor.name}: ${debt.description}`);
      await personal(tx, c, debt.creditorId, amount, "prestamo", `Me pagó ${debtor.name}: ${debt.description}`);
      await notify(tx, ctx.household.id, others(ctx), "Deudas", `${debtor.name} le pagó ${formatCents(amount)} a ${creditor.name} (${debt.description}).`, "/balance");
    });
    return done(amount === remaining ? "Deuda saldada." : "Abono registrado.", nextUrl(form));
  });
}

/** Saldar todo con otra persona: deudas, gastos compartidos y entregas de bolsas. */
export async function settleUp(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const other = memberOf(ctx, str(form, "otherId"));
    const occurredOn = dateOf(form, ctx);
    const fileId = await fileOf(ctx, form);
    const hh = ctx.household.id;

    await db.transaction(async (tx) => {
      // 0) partes del arriendo sin apartar en meses pagados: se apartan ahora
      const unpaid = (await pendingRentShares(tx, hh)).filter(
        (u) => [ctx.me.id, other.id].includes(u.memberId) && [ctx.me.id, other.id].includes(u.payerId),
      );
      const eventId = await createEvent(tx, {
        householdId: hh,
        type: "settlement",
        actorId: ctx.me.id,
        occurredOn,
        title: `Cuentas saldadas con ${other.name}`,
        fileId,
      });
      const c: Ctx = { householdId: hh, eventId, occurredOn };
      for (const u of unpaid) await setAside(tx, c, u.period, u.memberId, u.potId, u.amountCents);

      const ledger = await tx
        .select({ debtorId: schema.memberLedger.debtorId, creditorId: schema.memberLedger.creditorId, amountCents: schema.memberLedger.amountCents })
        .from(schema.memberLedger)
        .where(eq(schema.memberLedger.householdId, hh));
      const holdings = await currentHoldings(tx, hh);
      const deliveries = potDeliveries(holdings);
      const bal = pairBalance(ledger, deliveries, ctx.me.id, other.id);
      if (!bal) throw new UserError("Ya están a mano.");

      await tx.update(schema.events).set({
        amountCents: bal.netCents,
        detail: `${memberOf(ctx, bal.fromId).name} le pasó ${formatCents(bal.netCents)} a ${memberOf(ctx, bal.toId).name}`,
        data: { from: bal.fromId, to: bal.toId, deliveries: bal.deliveries, ledgerCents: bal.ledgerCents, rentShares: unpaid },
      }).where(eq(schema.events.id, eventId));

      // 1) entregas de bolsas
      for (const d of bal.deliveries) {
        await potMove(tx, c, d.potId, d.fromId, -d.amountCents, "handover");
        await potMove(tx, c, d.potId, d.toId, d.amountCents, "handover");
      }
      // 2) deudas: el que debe le paga al otro, repartido entre deudas abiertas
      if (bal.ledgerCents !== 0) {
        const [payer, payee] = bal.ledgerCents > 0 ? [bal.fromId, bal.toId] : [bal.toId, bal.fromId];
        const amount = Math.abs(bal.ledgerCents);
        const open = await tx.query.debts.findMany({
          where: and(eq(schema.debts.householdId, hh), eq(schema.debts.debtorId, payer), eq(schema.debts.creditorId, payee)),
          orderBy: asc(schema.debts.occurredOn),
        });
        const payments = await tx
          .select({ debtId: schema.memberLedger.debtId, amountCents: schema.memberLedger.amountCents })
          .from(schema.memberLedger)
          .where(and(eq(schema.memberLedger.householdId, hh), eq(schema.memberLedger.kind, "debt_payment")));
        const { allocations, unallocatedCents } = allocatePayment(
          amount,
          payer,
          payee,
          open,
          payments.filter((p): p is { debtId: string; amountCents: number } => !!p.debtId),
        );
        for (const a of allocations) {
          await owe(tx, c, payee, payer, a.amountCents, "debt_payment", a.debtId);
          await personal(tx, c, payer, -a.amountCents, "prestamo", `Pago de préstamo a ${memberOf(ctx, payee).name}`);
          await personal(tx, c, payee, a.amountCents, "prestamo", `Pago de préstamo de ${memberOf(ctx, payer).name}`);
        }
        await owe(tx, c, payee, payer, unallocatedCents, "settlement");
      }
      await notify(tx, hh, [other.id].filter((id) => ctx.members.find((m) => m.id === id)?.userId), "Cuentas saldadas", `${ctx.me.name} registró que quedaron a mano.`, "/balance");
    });
    return done("Quedaron a mano.", nextUrl(form) ?? "/balance");
  });
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

export async function markNotificationsRead() {
  const ctx = await actionContext();
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.memberId, ctx.me.id), isNull(schema.notifications.readAt)));
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Comprobante agregado después
// ---------------------------------------------------------------------------

export async function attachReceipt(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const event = await db.query.events.findFirst({
      where: and(eq(schema.events.id, str(form, "eventId")), eq(schema.events.householdId, ctx.household.id)),
    });
    if (!event || (event.privateTo && event.privateTo !== ctx.me.id)) return fail("Ese registro ya no existe.");
    const fileId = await fileOf(ctx, form);
    if (!fileId) return fail("Primero elige la imagen del comprobante.");
    await db.transaction(async (tx) => {
      if (event.fileId && event.fileId !== fileId) {
        await tx.update(schema.files).set({ draftStatus: "none" }).where(eq(schema.files.id, event.fileId));
      }
      await tx.update(schema.events).set({ fileId }).where(eq(schema.events.id, event.id));
      await tx.update(schema.files).set({ draftStatus: "used", privateTo: event.privateTo }).where(eq(schema.files.id, fileId));
      if (!event.privateTo) {
        await notify(tx, ctx.household.id, others(ctx), "Comprobante agregado", `${ctx.me.name} subió el comprobante de «${event.title}».`, `/movimientos/${event.id}`);
      }
    });
    return done("Comprobante guardado.");
  });
}

// ---------------------------------------------------------------------------
// Plata extra a una bolsa (sobrante de antes, un regalo, o de mi bolsillo)
// ---------------------------------------------------------------------------

export async function addPotMoney(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const pot = await potOf(ctx, str(form, "potId"));
    const amount = amountOf(form);
    const holder = memberOf(ctx, str(form, "holderId") || ctx.me.id, "quién tiene la plata");
    const fromPocket = str(form, "source") === "pocket";
    const occurredOn = dateOf(form, ctx);
    const description = str(form, "description") || (fromPocket ? `Puse plata en ${pot.name}` : `Plata extra para ${pot.name}`);
    const fileId = await fileOf(ctx, form);
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "pot_income",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: description,
        detail: `${pot.emoji} ${pot.name} · la tiene ${holder.name}${fromPocket ? " · de su bolsillo" : ""}`,
        category: "ingreso",
        fileId,
        data: { potId: pot.id, holderId: holder.id, source: fromPocket ? "pocket" : "outside" },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      await potMove(tx, c, pot.id, holder.id, amount, "extra");
      if (fromPocket) {
        await personal(tx, c, holder.id, -amount, pot.kind === "food" ? "super" : pot.kind === "services" ? "servicios" : pot.kind === "rent" ? "arriendo" : "casa", description);
      }
      await notify(tx, ctx.household.id, others(ctx), pot.name, `${ctx.me.name} agregó ${formatCents(amount)} a ${pot.name}.`, `/casa/bolsas/${pot.id}`);
    });
    return done(`Agregaste ${formatCents(amount)} a ${pot.name}.`, nextUrl(form));
  });
}

// ---------------------------------------------------------------------------
// Ajustar el arriendo del mes cuando cambian las partes después de apartarlas
// ---------------------------------------------------------------------------

export async function rentAdjust(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const { rent, shares } = await rentContext(ctx);
    const period = str(form, "period") || monthKey(todayISO(ctx.household.timezone));
    const occurredOn = todayISO(ctx.household.timezone);
    const marks = await db.query.rentMarks.findMany({
      where: and(eq(schema.rentMarks.householdId, ctx.household.id), eq(schema.rentMarks.period, period), eq(schema.rentMarks.kind, "set_aside")),
    });
    const diffs = marks
      .map((m) => ({ mark: m, diff: m.amountCents - (shares[m.memberId] ?? m.amountCents) }))
      .filter((d) => d.diff !== 0);
    if (!diffs.length) return fail("Las partes ya coinciden con el monto actual.");

    const lines: string[] = [];
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "rent_adjust",
        actorId: ctx.me.id,
        occurredOn,
        title: `Ajuste del arriendo de ${periodLabel(period)}`,
        category: "arriendo",
        data: { period, diffs: diffs.map((d) => ({ memberId: d.mark.memberId, from: d.mark.amountCents, to: shares[d.mark.memberId] })) },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      for (const { mark, diff } of diffs) {
        const m = memberOf(ctx, mark.memberId);
        if (diff > 0) {
          // apartó de más: se le devuelve la diferencia de la bolsa del arriendo
          const holdings = await currentHoldings(tx, ctx.household.id, [rent.potId]);
          const parts = takeFromHolders(holdings[rent.potId] ?? {}, diff, m.id);
          const taken = parts.reduce((a, p) => a + p.amountCents, 0);
          if (taken < diff) throw new UserError(`En la bolsa del arriendo no hay ${formatCents(diff)} para devolverle a ${m.name}.`);
          for (const p of parts) {
            await potMove(tx, c, rent.potId, p.holderId, -p.amountCents, "rent_adjust");
            // si la plata la tiene otra persona, esa persona se la debe devolver
            if (p.holderId !== m.id) await owe(tx, c, p.holderId, m.id, p.amountCents, "rent_adjust");
          }
          await personal(tx, c, m.id, diff, "arriendo", `Devolución de la parte del arriendo de ${periodLabel(period)}`);
          lines.push(`a ${m.name} se le devuelven ${formatCents(diff)}`);
        } else {
          // apartó de menos: pone la diferencia
          await potMove(tx, c, rent.potId, m.id, -diff, "rent_share");
          await personal(tx, c, m.id, diff, "arriendo", `Diferencia de la parte del arriendo de ${periodLabel(period)}`);
          lines.push(`${m.name} pone ${formatCents(-diff)} más`);
        }
        await tx.update(schema.rentMarks).set({ amountCents: shares[mark.memberId] }).where(eq(schema.rentMarks.id, mark.id));
      }
      await tx.update(schema.events).set({ detail: lines.join(" · ") }).where(eq(schema.events.id, eventId));
      await notify(tx, ctx.household.id, others(ctx), "Arriendo ajustado", `${ctx.me.name} ajustó las partes de ${periodLabel(period)}: ${lines.join(", ")}.`, "/casa/arriendo");
    });
    return done(`Listo: ${lines.join(", ")}.`);
  });
}

// ---------------------------------------------------------------------------
// Igualar la cuenta personal con lo que hay de verdad en el banco
// ---------------------------------------------------------------------------

export async function setBankBalance(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const actual = parseAmountToCents(str(form, "actual"));
    if (actual === null) return fail("Escribe cuánto tienes.");
    const money = await personalMoney(ctx);
    const diff = actual - money.total;
    if (diff === 0) return ok("Ya coincide con tu banco.");
    const occurredOn = todayISO(ctx.household.timezone);
    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "balance_adjust",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: diff,
        title: "Ajuste de saldo con el banco",
        detail: `Tenía ${formatCents(actual)}; la app decía ${formatCents(money.total)}`,
        category: "ajuste",
        privateTo: ctx.me.id,
      });
      await personal(tx, { householdId: ctx.household.id, eventId, occurredOn }, ctx.me.id, diff, "ajuste", "Ajuste de saldo con el banco");
    });
    return done(`Listo: ahora la app dice ${formatCents(actual)}.`);
  });
}
