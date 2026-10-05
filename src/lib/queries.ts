import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "./db";
import type { AppContext } from "./auth";
import {
  ledgerNet,
  pairBalance,
  potDeliveries,
  potHoldings,
  potTotal,
  type PairBalance,
} from "./domain/balances";
import { rentSummary, type RentSummary } from "./domain/rent";
import { serviceStatus, type ServiceStatus } from "./domain/services";
import {
  comparePeriods,
  monthKey,
  periodLabel,
  periodsBetween,
  previousPeriods,
  todayISO,
  weekKey,
} from "./periods";
import type { Contribution, ContributionLine, Pot, Service } from "./db/schema";
import { pendingRentShares } from "./ledger";

export type PotState = Pot & {
  totalCents: number;
  byMember: Record<string, number>;
  /** reservado para servicios pendientes de esta bolsa */
  committedCents: number;
  availableCents: number;
};

export type DueContribution = {
  contribution: Contribution;
  lines: ContributionLine[];
  period: string;
  label: string;
  overdue: boolean;
  totalCents: number;
};

export type ServiceState = { service: Service; status: ServiceStatus; pot: Pot | undefined };

export type RentState = {
  period: string;
  periodLabel: string;
  totalCents: number;
  dueDay: number;
  payerId: string | null;
  potId: string;
  shares: Record<string, number>;
  lines: {
    key: string;
    contributionId: string;
    label: string;
    source: string;
    amountCents: number;
    receivedBy: string | null;
    receivedOn: string | null;
    skipped: boolean;
    eventId: string | null;
  }[];
  marks: { memberId: string; kind: "set_aside" | "delivered"; eventId: string; markedOn: string; amountCents: number }[];
  payment: { paidBy: string; paidOn: string; eventId: string; amountCents: number } | null;
  summary: RentSummary;
};

export type Shortfall = { pot: PotState; missingCents: number };

const LOOKBACK = { weekly: 6, monthly: 3 } as const;

export const loadHouse = cache(async (ctx: AppContext) => {
  const hh = ctx.household.id;
  const today = todayISO(ctx.household.timezone);
  const month = monthKey(today);
  const week = weekKey(today);

  const [pots, movements, ledger, rent, shares, contributions, services] = await Promise.all([
    db.query.pots.findMany({
      where: and(eq(schema.pots.householdId, hh), eq(schema.pots.archived, false)),
      orderBy: [asc(schema.pots.sortOrder), asc(schema.pots.createdAt)],
    }),
    db
      .select({
        potId: schema.potMovements.potId,
        holderId: schema.potMovements.holderId,
        amountCents: schema.potMovements.amountCents,
      })
      .from(schema.potMovements)
      .where(eq(schema.potMovements.householdId, hh)),
    db
      .select({
        debtorId: schema.memberLedger.debtorId,
        creditorId: schema.memberLedger.creditorId,
        amountCents: schema.memberLedger.amountCents,
      })
      .from(schema.memberLedger)
      .where(eq(schema.memberLedger.householdId, hh)),
    db.query.rentConfig.findFirst({ where: eq(schema.rentConfig.householdId, hh) }),
    db.query.rentShares.findMany({ where: eq(schema.rentShares.householdId, hh) }),
    db.query.contributions.findMany({
      where: and(eq(schema.contributions.householdId, hh), eq(schema.contributions.active, true)),
      orderBy: [asc(schema.contributions.sortOrder), asc(schema.contributions.createdAt)],
    }),
    db.query.services.findMany({
      where: and(eq(schema.services.householdId, hh), eq(schema.services.active, true)),
      orderBy: [asc(schema.services.sortOrder), asc(schema.services.createdAt)],
    }),
  ]);

  const unpaidShares = await pendingRentShares(db, hh);
  // deudas implícitas: partes del arriendo que puso quien pagó al dueño
  const fullLedger = [
    ...ledger,
    ...unpaidShares.map((u) => ({ debtorId: u.memberId, creditorId: u.payerId, amountCents: u.amountCents })),
  ];

  const contributionIds = contributions.map((c) => c.id);
  const serviceIds = services.map((s) => s.id);
  const [lines, receipts, payments, rentMarks, rentPayment] = await Promise.all([
    contributionIds.length
      ? db.query.contributionLines.findMany({
          where: inArray(schema.contributionLines.contributionId, contributionIds),
          orderBy: asc(schema.contributionLines.sortOrder),
        })
      : Promise.resolve([]),
    contributionIds.length
      ? db.query.contributionReceipts.findMany({
          where: inArray(schema.contributionReceipts.contributionId, contributionIds),
        })
      : Promise.resolve([]),
    serviceIds.length
      ? db.query.servicePayments.findMany({ where: inArray(schema.servicePayments.serviceId, serviceIds) })
      : Promise.resolve([]),
    db.query.rentMarks.findMany({
      where: and(eq(schema.rentMarks.householdId, hh), eq(schema.rentMarks.period, month)),
    }),
    db.query.rentPayments.findFirst({
      where: and(eq(schema.rentPayments.householdId, hh), eq(schema.rentPayments.period, month)),
    }),
  ]);

  // ---- servicios ----
  const serviceStates: ServiceState[] = services.map((s) => ({
    service: s,
    pot: pots.find((p) => p.id === s.potId),
    status: serviceStatus(
      s.startPeriod,
      month,
      payments
        .filter((p) => p.serviceId === s.id)
        .map((p) => ({ periods: p.periods, amountCents: p.amountCents, paidOn: p.paidOn })),
    ),
  }));

  // ---- bolsas ----
  const holdings = potHoldings(movements);
  const potStates: PotState[] = pots.map((p) => {
    const totalCents = potTotal(holdings, p.id);
    const committedCents = serviceStates
      .filter((s) => s.service.potId === p.id)
      .reduce((a, s) => a + s.status.committedCents, 0);
    return {
      ...p,
      totalCents,
      byMember: holdings[p.id] ?? {},
      committedCents,
      availableCents: totalCents - committedCents,
    };
  });
  const deliveries = potDeliveries(holdings);

  // ---- aportes pendientes ----
  const due: DueContribution[] = [];
  for (const c of contributions) {
    const current = c.frequency === "weekly" ? week : month;
    const window = previousPeriods(current, LOOKBACK[c.frequency as "weekly" | "monthly"]);
    const periods = window.filter((p) => comparePeriods(p, c.startPeriod) >= 0);
    const cLines = lines.filter((l) => l.contributionId === c.id);
    for (const period of periods) {
      if (receipts.some((r) => r.contributionId === c.id && r.period === period)) continue;
      due.push({
        contribution: c,
        lines: cLines,
        period,
        label: periodLabel(period),
        overdue: period !== current,
        totalCents: cLines.reduce((a, l) => a + l.amountCents, 0),
      });
    }
  }

  // ---- arriendo del mes ----
  let rentState: RentState | null = null;
  if (rent?.active && comparePeriods(month, rent.startPeriod) >= 0) {
    const sharesMap = Object.fromEntries(shares.map((s) => [s.memberId, s.amountCents]));
    const rentLines: RentState["lines"] = [];
    for (const c of contributions.filter((c) => c.frequency === "monthly")) {
      for (const l of lines.filter((l) => l.contributionId === c.id && l.potId === rent.potId)) {
        const r = receipts.find((r) => r.contributionId === c.id && r.period === month);
        rentLines.push({
          key: l.id,
          contributionId: c.id,
          label: lines.filter((x) => x.contributionId === c.id).length === 1 ? c.name : `${c.name}: ${l.label}`,
          source: c.source,
          amountCents: l.amountCents,
          receivedBy: r?.status === "received" ? r.receivedBy : null,
          receivedOn: r?.status === "received" ? r.receivedOn : null,
          skipped: r?.status === "skipped",
          eventId: r?.eventId ?? null,
        });
      }
    }
    const marks = rentMarks.map((m) => ({
      memberId: m.memberId,
      kind: m.kind as "set_aside" | "delivered",
      eventId: m.eventId,
      markedOn: m.markedOn,
      amountCents: m.amountCents,
    }));
    const payment = rentPayment
      ? { paidBy: rentPayment.paidBy, paidOn: rentPayment.paidOn, eventId: rentPayment.eventId, amountCents: rentPayment.amountCents }
      : null;
    rentState = {
      period: month,
      periodLabel: periodLabel(month),
      totalCents: rent.totalCents,
      dueDay: rent.dueDay,
      payerId: rent.payerId,
      potId: rent.potId,
      shares: sharesMap,
      lines: rentLines,
      marks,
      payment,
      summary: rentSummary({
        viewerId: ctx.me.id,
        members: ctx.members.map((m) => ({ id: m.id, name: m.name })),
        shares: sharesMap,
        payerId: rent.payerId,
        totalCents: rent.totalCents,
        lines: rentLines,
        marks,
        payment,
        holdings: holdings[rent.potId] ?? {},
      }),
    };
  }

  // ---- faltantes ----
  const pendingRentTotal = unpaidShares.reduce((a, u) => a + u.amountCents, 0);
  const shortfalls: Shortfall[] = potStates
    .map((p) => {
      let missing = -p.totalCents;
      if (rent && p.id === rent.potId) missing -= pendingRentTotal;
      return { pot: p, missingCents: missing };
    })
    .filter((s) => s.missingCents > 0);

  // ---- balance con cada persona ----
  const balances = ctx.others
    .map((o) => pairBalance(fullLedger, deliveries, ctx.me.id, o.id))
    .filter((b): b is PairBalance => b !== null);

  return {
    today,
    month,
    week,
    pots: potStates,
    deliveries,
    balances,
    ledgerNetWith: (otherId: string) => ledgerNet(fullLedger, ctx.me.id, otherId),
    unpaidRentShares: unpaidShares,
    rent: rentState,
    due,
    services: serviceStates,
    shortfalls,
  };
});

export type HouseState = Awaited<ReturnType<typeof loadHouse>>;

export async function unreadCount(memberId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.memberId, memberId), isNull(schema.notifications.readAt)));
  return value;
}

export async function pendingDrafts(ctx: AppContext) {
  return db.query.files.findMany({
    where: and(
      eq(schema.files.householdId, ctx.household.id),
      eq(schema.files.uploadedBy, ctx.me.id),
      eq(schema.files.draftStatus, "pending"),
    ),
    orderBy: desc(schema.files.createdAt),
  });
}

/** Períodos de un servicio disponibles para marcar en un pago (pendientes + el siguiente). */
export function servicePeriodsToPay(state: ServiceState, month: string): string[] {
  const pending = state.status.pending;
  if (pending.length) return pending;
  return periodsBetween(month, month);
}

export async function listEvents(
  ctx: AppContext,
  opts: { limit?: number; filter?: "todos" | "casa" | "personales"; before?: string } = {},
) {
  const visible = or(isNull(schema.events.privateTo), eq(schema.events.privateTo, ctx.me.id));
  const filter =
    opts.filter === "personales"
      ? eq(schema.events.privateTo, ctx.me.id)
      : opts.filter === "casa"
        ? isNull(schema.events.privateTo)
        : visible;
  return db.query.events.findMany({
    where: and(eq(schema.events.householdId, ctx.household.id), filter),
    orderBy: [desc(schema.events.occurredOn), desc(schema.events.createdAt)],
    limit: opts.limit ?? 50,
  });
}
