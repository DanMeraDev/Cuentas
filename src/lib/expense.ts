import "server-only";
import { db, schema } from "./db";
import type { AppContext } from "./auth";
import type { Member, Pot } from "./db/schema";
import { createEvent, notify, owe, personal, potMove, type Ctx } from "./ledger";
import { categoryOf } from "./defaults";
import { formatCents } from "./money";

export type ExpenseInput = {
  scope: "personal" | "shared" | "pot";
  amount: number;
  occurredOn: string;
  description: string;
  merchant: string | null;
  category: string;
  paidBy: Member;
  /** solo para compartidos: cuánto le toca a cada uno (suma = amount) */
  shares: { memberId: string; amountCents: number }[];
  pot: Pot | null;
  fileId: string | null;
};

/** Registra un gasto (personal, compartido o de una bolsa) con sus asientos y avisos. */
export async function recordExpense(ctx: AppContext, input: ExpenseInput) {
  const { scope, amount, occurredOn, description, merchant, category, paidBy, shares, pot, fileId } = input;
  const cat = categoryOf(category);
  const others = (c: AppContext) => c.others.filter((m) => m.userId).map((m) => m.id);
  await db.transaction(async (tx) => {
    const eventId = await createEvent(tx, {
      householdId: ctx.household.id,
      type: "expense",
      actorId: ctx.me.id,
      occurredOn,
      amountCents: amount,
      title: description,
      detail:
        scope === "personal"
          ? "Personal"
          : scope === "shared"
            ? `Compartido · pagó ${paidBy.name}`
            : `De la bolsa ${pot!.name} · pagó ${paidBy.name}`,
      category,
      fileId,
      privateTo: scope === "personal" ? ctx.me.id : null,
      data: { scope, merchant, potId: pot?.id ?? null, paidBy: paidBy.id, shares },
    });
    const c: Ctx = { householdId: ctx.household.id, eventId, occurredOn };
    const [expense] = await tx
      .insert(schema.expenses)
      .values({
        householdId: ctx.household.id,
        eventId,
        scope,
        potId: pot?.id ?? null,
        paidBy: paidBy.id,
        amountCents: amount,
        merchant,
        description,
        category,
        occurredOn,
      })
      .returning({ id: schema.expenses.id });

    if (scope === "personal") {
      await personal(tx, c, ctx.me.id, -amount, category, description);
    } else if (scope === "shared") {
      await tx.insert(schema.expenseShares).values(shares.map((s) => ({ expenseId: expense.id, ...s })));
      for (const s of shares) {
        await owe(tx, c, s.memberId, paidBy.id, s.amountCents, "shared_expense");
        await personal(tx, c, s.memberId, -s.amountCents, category, `${description} (compartido)`);
      }
      for (const o of ctx.others.filter((m) => m.userId)) {
        const mine = shares.find((s) => s.memberId === o.id)?.amountCents ?? 0;
        await notify(
          tx,
          ctx.household.id,
          [o.id],
          `${cat.emoji} Gasto compartido: ${description}`,
          `${paidBy.id === o.id ? "Pagaste tú" : `Pagó ${paidBy.name}`} ${formatCents(amount)}. Te toca ${formatCents(mine)}.`,
          "/movimientos",
        );
      }
    } else if (pot) {
      await potMove(tx, c, pot.id, paidBy.id, -amount, "expense");
      await notify(tx, ctx.household.id, others(ctx), `${cat.emoji} ${description}`, `${paidBy.name} pagó ${formatCents(amount)} de la bolsa ${pot.name}.`, "/movimientos");
    }
  });
}
