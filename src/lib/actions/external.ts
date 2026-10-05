"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { actionContext, type AppContext } from "@/lib/auth";
import { createEvent, notify, owe, personal, potMove, type Ctx } from "@/lib/ledger";
import { allocateExternal, externalRemaining } from "@/lib/domain/external";
import { formatCents, parseAmountToCents, splitEvenly } from "@/lib/money";
import { todayISO } from "@/lib/periods";
import { CATEGORIES } from "@/lib/defaults";
import { attempt, fail, ok, UserError, type ActionResult } from "./result";

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function member(ctx: AppContext, id: string) {
  const m = ctx.members.find((m) => m.id === id);
  if (!m) throw new UserError("Elige a la persona de la casa.");
  return m;
}

async function pot(ctx: AppContext, id: string) {
  const p = await db.query.pots.findFirst({
    where: and(eq(schema.pots.id, id), eq(schema.pots.householdId, ctx.household.id)),
  });
  if (!p) throw new UserError("Elige la bolsa.");
  return p;
}

function dateOf(form: FormData, ctx: AppContext) {
  const v = str(form, "occurredOn");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayISO(ctx.household.timezone);
}

async function fileOf(ctx: AppContext, form: FormData) {
  const id = str(form, "fileId");
  if (!id) return null;
  const f = await db.query.files.findFirst({
    where: and(eq(schema.files.id, id), eq(schema.files.householdId, ctx.household.id)),
  });
  return f?.id ?? null;
}

const othersOf = (ctx: AppContext) => ctx.others.filter((m) => m.userId).map((m) => m.id);

/**
 * Préstamo con alguien de fuera de la casa.
 * - we_owe: nos prestaron. La plata entra a una bolsa (deuda de todos) o a una persona.
 * - they_owe: le prestamos. La plata sale de una bolsa (de todos) o de una persona.
 */
export async function createExternalDebt(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const direction = str(form, "direction") === "they_owe" ? "they_owe" : "we_owe";
    const personName = str(form, "personName");
    if (!personName) return fail("Escribe el nombre de la persona.");
    const amount = parseAmountToCents(str(form, "amount"));
    if (!amount || amount <= 0) return fail("Revisa el monto.");
    const rawMode = str(form, "mode");
    // "spent" (pagó algo por nosotros) solo aplica cuando nos prestaron
    const mode = rawMode === "personal" ? "personal" : rawMode === "spent" && direction === "we_owe" ? "spent" : "pot";
    const who = member(ctx, str(form, "memberId") || ctx.me.id);
    const p = mode === "pot" ? await pot(ctx, str(form, "potId")) : null;
    const category = mode === "spent" ? CATEGORIES.find((c) => c.key === str(form, "category"))?.key ?? "otros" : null;
    // en "spent", owner = "all" (se divide) o el id de quien debe todo
    const owner = mode === "spent" ? str(form, "owner") || "all" : "all";
    const description = str(form, "description") || (direction === "we_owe" ? `Préstamo de ${personName}` : `Préstamo a ${personName}`);
    const occurredOn = dateOf(form, ctx);
    const fileId = await fileOf(ctx, form);

    // de quién es la deuda (o el préstamo)
    let shares: { memberId: string; amountCents: number }[];
    if (mode === "personal") {
      shares = [{ memberId: who.id, amountCents: amount }];
    } else if (mode === "spent" && owner !== "all") {
      shares = [{ memberId: member(ctx, owner).id, amountCents: amount }];
    } else if (str(form, "split") === "custom") {
      shares = ctx.members.map((m) => ({ memberId: m.id, amountCents: parseAmountToCents(str(form, `share_${m.id}`)) ?? 0 }));
      const sum = shares.reduce((a, s) => a + s.amountCents, 0);
      if (sum !== amount) return fail(`Las partes suman ${formatCents(sum)} y el préstamo es ${formatCents(amount)}.`);
      shares = shares.filter((s) => s.amountCents > 0);
    } else {
      const parts = splitEvenly(amount, ctx.members.length);
      shares = ctx.members.map((m, i) => ({ memberId: m.id, amountCents: parts[i] }));
    }

    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "external_debt",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: description,
        detail:
          mode === "spent"
            ? `${personName} pagó por ${shares.length > 1 ? "nosotros" : ctx.members.find((m) => m.id === shares[0].memberId)?.name}`
            : direction === "we_owe"
              ? `${personName} nos prestó · ${p ? `entró a ${p.name}` : `lo recibió ${who.name}`}`
              : `Le prestamos a ${personName} · ${p ? `salió de ${p.name}` : `lo prestó ${who.name}`}`,
        category: category ?? "prestamo",
        fileId,
        data: { direction, personName, mode, potId: p?.id ?? null, memberId: who.id, shares, category },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      const [debt] = await tx
        .insert(schema.externalDebts)
        .values({
          householdId: ctx.household.id,
          eventId,
          personName,
          direction,
          mode,
          category,
          potId: p?.id ?? null,
          amountCents: amount,
          description,
          occurredOn,
        })
        .returning({ id: schema.externalDebts.id });
      await tx.insert(schema.externalDebtShares).values(shares.map((s) => ({ externalDebtId: debt.id, ...s })));

      // si pagó algo por nosotros no entra plata: solo queda la deuda
      const sign = direction === "we_owe" ? 1 : -1;
      if (p) await potMove(tx, c, p.id, who.id, sign * amount, "external_loan");
      else if (mode === "personal") await personal(tx, c, who.id, sign * amount, "prestamo", description);

      await notify(
        tx,
        ctx.household.id,
        othersOf(ctx),
        direction === "we_owe" ? `${personName} nos prestó ${formatCents(amount)}` : `Le prestamos ${formatCents(amount)} a ${personName}`,
        shares.length > 1
          ? `A cada uno le toca ${shares.map((s) => `${ctx.members.find((m) => m.id === s.memberId)?.name} ${formatCents(s.amountCents)}`).join(", ")}.`
          : description,
        "/balance",
      );
    });
    revalidatePath("/", "layout");
    redirect("/balance");
  });
}

/** Pago (we_owe) o devolución (they_owe) de un préstamo externo. */
export async function payExternalDebt(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const debt = await db.query.externalDebts.findFirst({
      where: and(eq(schema.externalDebts.id, str(form, "externalDebtId")), eq(schema.externalDebts.householdId, ctx.household.id)),
    });
    if (!debt) return fail("Préstamo no encontrado.");
    const who = member(ctx, str(form, "memberId") || ctx.me.id);
    const source = str(form, "source") === "pot" ? "pot" : "personal";
    const p = source === "pot" ? await pot(ctx, str(form, "potId")) : null;
    const occurredOn = dateOf(form, ctx);
    const fileId = await fileOf(ctx, form);

    const shares = await db.query.externalDebtShares.findMany({ where: eq(schema.externalDebtShares.externalDebtId, debt.id) });
    const payments = await db.query.externalPayments.findMany({ where: eq(schema.externalPayments.externalDebtId, debt.id) });
    const paidShares = payments.length
      ? await db.query.externalPaymentShares.findMany({
          where: inArray(schema.externalPaymentShares.paymentId, payments.map((x) => x.id)),
        })
      : [];
    const remaining = externalRemaining(shares, paidShares);
    const totalLeft = Object.values(remaining).reduce((a, b) => a + b, 0);
    if (totalLeft <= 0) return fail("Este préstamo ya está saldado.");
    const amount = parseAmountToCents(str(form, "amount")) ?? totalLeft;
    if (amount <= 0) return fail("Revisa el monto.");
    if (amount > totalLeft) return fail(`Solo faltan ${formatCents(totalLeft)}.`);

    const alloc = allocateExternal(remaining, amount, source === "pot" ? "even" : "self-first", who.id);
    const weOwe = debt.direction === "we_owe";

    await db.transaction(async (tx) => {
      const eventId = await createEvent(tx, {
        householdId: ctx.household.id,
        type: "external_payment",
        actorId: ctx.me.id,
        occurredOn,
        amountCents: amount,
        title: weOwe ? `Le pagamos a ${debt.personName}` : `${debt.personName} nos devolvió`,
        detail: `${debt.description} · ${p ? (weOwe ? `salió de ${p.name}` : `entró a ${p.name}`) : weOwe ? `pagó ${who.name}` : `lo recibió ${who.name}`}`,
        category: "prestamo",
        fileId,
        data: { externalDebtId: debt.id, memberId: who.id, source, potId: p?.id ?? null, alloc },
      });
      const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
      const [payment] = await tx
        .insert(schema.externalPayments)
        .values({ householdId: ctx.household.id, eventId, externalDebtId: debt.id, memberId: who.id, potId: p?.id ?? null, amountCents: amount, occurredOn })
        .returning({ id: schema.externalPayments.id });
      await tx.insert(schema.externalPaymentShares).values(
        Object.entries(alloc).map(([memberId, amountCents]) => ({ paymentId: payment.id, memberId, amountCents })),
      );

      if (p) {
        await potMove(tx, c, p.id, who.id, weOwe ? -amount : amount, "external_payment");
      } else if (debt.mode === "spent") {
        // Pagó algo por nosotros: al pagarle, cada uno ve su parte como gasto
        // (ej. comida). Si quien paga cubre la parte de otro, se la presta.
        const cat = debt.category ?? "otros";
        await personal(tx, c, who.id, -(alloc[who.id] ?? 0), cat, `${debt.description} (le pagué a ${debt.personName})`);
        for (const [memberId, part] of Object.entries(alloc)) {
          if (memberId === who.id || part <= 0) continue;
          const other = member(ctx, memberId);
          await personal(tx, c, who.id, -part, "prestamo", `Pagué la parte de ${other.name} a ${debt.personName}`);
          await personal(tx, c, memberId, -part, cat, `${debt.description} (pagó ${who.name})`);
          await personal(tx, c, memberId, part, "prestamo", `${who.name} pagó mi parte a ${debt.personName}`);
          const [d] = await tx
            .insert(schema.debts)
            .values({ householdId: ctx.household.id, eventId, debtorId: memberId, creditorId: who.id, amountCents: part, description: `${who.name} pagó tu parte a ${debt.personName}`, occurredOn })
            .returning({ id: schema.debts.id });
          await owe(tx, c, memberId, who.id, part, "debt", d.id);
        }
      } else {
        await personal(tx, c, who.id, weOwe ? -amount : amount, "prestamo", weOwe ? `Le pagué a ${debt.personName}` : `${debt.personName} me devolvió`);
        // Si cubrió la parte de otro, queda como préstamo entre ellos (o al revés si
        // cobró la parte de otro). Se guarda como deuda normal para que, al pagarse,
        // también se refleje en las cuentas personales.
        for (const [memberId, part] of Object.entries(alloc)) {
          if (memberId === who.id || part <= 0) continue;
          const [debtorId, creditorId] = weOwe ? [memberId, who.id] : [who.id, memberId];
          const description = weOwe
            ? `${who.name} pagó tu parte a ${debt.personName}`
            : `${who.name} cobró tu parte a ${debt.personName}`;
          const [d] = await tx
            .insert(schema.debts)
            .values({ householdId: ctx.household.id, eventId, debtorId, creditorId, amountCents: part, description, occurredOn })
            .returning({ id: schema.debts.id });
          await owe(tx, c, debtorId, creditorId, part, "debt", d.id);
        }
      }
      await notify(
        tx,
        ctx.household.id,
        othersOf(ctx),
        weOwe ? `Pago a ${debt.personName}` : `${debt.personName} devolvió plata`,
        `${who.name} ${weOwe ? "pagó" : "recibió"} ${formatCents(amount)} (${debt.description}).`,
        "/balance",
      );
    });
    revalidatePath("/", "layout");
    return ok(amount === totalLeft ? "Préstamo saldado." : "Pago registrado.");
  });
}
