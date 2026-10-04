import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { schema, type Tx } from "./db";
import { potHoldings, takeFromHolders } from "./domain/balances";

// Escrituras de bajo nivel. Siempre dentro de una transacción y colgadas de un
// evento, para que deshacer = borrar el evento.

export type NewEvent = {
  householdId: string;
  type: string;
  actorId: string;
  occurredOn: string;
  amountCents?: number;
  title: string;
  detail?: string | null;
  category?: string | null;
  fileId?: string | null;
  privateTo?: string | null;
  data?: Record<string, unknown>;
};

export async function createEvent(tx: Tx, e: NewEvent): Promise<string> {
  const [row] = await tx
    .insert(schema.events)
    .values({
      householdId: e.householdId,
      type: e.type,
      actorId: e.actorId,
      occurredOn: e.occurredOn,
      amountCents: e.amountCents ?? 0,
      title: e.title,
      detail: e.detail ?? null,
      category: e.category ?? null,
      fileId: e.fileId ?? null,
      privateTo: e.privateTo ?? null,
      data: e.data ?? {},
    })
    .returning({ id: schema.events.id });
  if (e.fileId) {
    await tx
      .update(schema.files)
      .set({ draftStatus: "used", privateTo: e.privateTo ?? null })
      .where(eq(schema.files.id, e.fileId));
  }
  return row.id;
}

export type Ctx = { householdId: string; eventId: string; occurredOn: string };

export async function potMove(
  tx: Tx,
  c: Ctx,
  potId: string,
  holderId: string,
  amountCents: number,
  kind: string,
) {
  if (amountCents === 0) return;
  await tx.insert(schema.potMovements).values({
    householdId: c.householdId,
    eventId: c.eventId,
    potId,
    holderId,
    amountCents,
    kind,
    occurredOn: c.occurredOn,
  });
}

export async function owe(
  tx: Tx,
  c: Ctx,
  debtorId: string,
  creditorId: string,
  amountCents: number,
  kind: string,
  debtId?: string | null,
) {
  if (amountCents <= 0 || debtorId === creditorId) return;
  await tx.insert(schema.memberLedger).values({
    householdId: c.householdId,
    eventId: c.eventId,
    debtorId,
    creditorId,
    amountCents,
    kind,
    debtId: debtId ?? null,
    occurredOn: c.occurredOn,
  });
}

export async function personal(
  tx: Tx,
  c: Ctx,
  memberId: string,
  amountCents: number,
  category: string,
  description: string,
) {
  if (amountCents === 0) return;
  await tx.insert(schema.personalEntries).values({
    householdId: c.householdId,
    eventId: c.eventId,
    memberId,
    amountCents,
    category,
    description,
    occurredOn: c.occurredOn,
  });
}

/** Saldos actuales de una o varias bolsas, por custodio. */
export async function currentHoldings(tx: Tx, householdId: string, potIds?: string[]) {
  const rows = await tx
    .select({
      potId: schema.potMovements.potId,
      holderId: schema.potMovements.holderId,
      amountCents: schema.potMovements.amountCents,
    })
    .from(schema.potMovements)
    .where(
      potIds
        ? and(eq(schema.potMovements.householdId, householdId), inArray(schema.potMovements.potId, potIds))
        : eq(schema.potMovements.householdId, householdId),
    );
  return potHoldings(rows);
}

/**
 * Pasa plata de una bolsa a otra. La plata sale de quienes la tienen en la
 * bolsa origen y queda en la bolsa destino en las mismas manos.
 */
export async function transferBetweenPots(
  tx: Tx,
  c: Ctx,
  fromPotId: string,
  toPotId: string,
  amountCents: number,
  preferredHolderId?: string,
): Promise<number> {
  const holdings = await currentHoldings(tx, c.householdId, [fromPotId]);
  const parts = takeFromHolders(holdings[fromPotId] ?? {}, amountCents, preferredHolderId);
  let moved = 0;
  for (const p of parts) {
    await potMove(tx, c, fromPotId, p.holderId, -p.amountCents, "transfer_out");
    await potMove(tx, c, toPotId, p.holderId, p.amountCents, "transfer_in");
    moved += p.amountCents;
  }
  return moved;
}

export async function notify(
  tx: Tx,
  householdId: string,
  memberIds: string[],
  title: string,
  body?: string | null,
  href?: string | null,
) {
  if (!memberIds.length) return;
  await tx.insert(schema.notifications).values(
    memberIds.map((memberId) => ({ householdId, memberId, title, body: body ?? null, href: href ?? null })),
  );
}

export type PendingRentShare = { period: string; memberId: string; payerId: string; amountCents: number; potId: string };

/**
 * Partes del arriendo que nadie apartó en meses ya pagados: quien pagó al
 * dueño las puso de su bolsillo, así que cuentan como deuda con esa persona.
 */
export async function pendingRentShares(tx: Tx | typeof import("./db").db, householdId: string): Promise<PendingRentShare[]> {
  const [rent, shares, payments, marks] = await Promise.all([
    tx.query.rentConfig.findFirst({ where: eq(schema.rentConfig.householdId, householdId) }),
    tx.query.rentShares.findMany({ where: eq(schema.rentShares.householdId, householdId) }),
    tx.query.rentPayments.findMany({ where: eq(schema.rentPayments.householdId, householdId) }),
    tx.query.rentMarks.findMany({
      where: and(eq(schema.rentMarks.householdId, householdId), eq(schema.rentMarks.kind, "set_aside")),
    }),
  ]);
  if (!rent) return [];
  const out: PendingRentShare[] = [];
  for (const p of payments) {
    for (const s of shares) {
      if (s.memberId === p.paidBy || s.amountCents <= 0) continue;
      if (marks.some((m) => m.period === p.period && m.memberId === s.memberId)) continue;
      out.push({ period: p.period, memberId: s.memberId, payerId: p.paidBy, amountCents: s.amountCents, potId: rent.potId });
    }
  }
  return out;
}
