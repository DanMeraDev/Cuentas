// Cálculos puros de saldos: bolsas, custodios y deudas entre miembros.

export type PotMovementLite = {
  potId: string;
  holderId: string;
  amountCents: number;
};

export type LedgerLite = {
  debtorId: string;
  creditorId: string;
  amountCents: number;
};

/** potId -> memberId -> centavos que esa persona tiene de esa bolsa. */
export type Holdings = Record<string, Record<string, number>>;

export function potHoldings(movements: PotMovementLite[]): Holdings {
  const out: Holdings = {};
  for (const m of movements) {
    const pot = (out[m.potId] ??= {});
    pot[m.holderId] = (pot[m.holderId] ?? 0) + m.amountCents;
  }
  return out;
}

export function potTotal(holdings: Holdings, potId: string): number {
  return Object.values(holdings[potId] ?? {}).reduce((a, b) => a + b, 0);
}

export type PotDelivery = {
  potId: string;
  fromId: string; // tiene plata de la bolsa
  toId: string; // puso plata de su bolsillo por la bolsa
  amountCents: number;
};

/**
 * Si alguien pagó algo de una bolsa con su propia plata (saldo negativo) y otra
 * persona tiene plata de esa bolsa (saldo positivo), la segunda le debe
 * entregar esa plata a la primera.
 */
export function potDeliveries(holdings: Holdings): PotDelivery[] {
  const out: PotDelivery[] = [];
  for (const [potId, byMember] of Object.entries(holdings)) {
    const positives = Object.entries(byMember)
      .filter(([, v]) => v > 0)
      .map(([id, v]) => ({ id, v }))
      .sort((a, b) => b.v - a.v);
    const negatives = Object.entries(byMember)
      .filter(([, v]) => v < 0)
      .map(([id, v]) => ({ id, v: -v }))
      .sort((a, b) => b.v - a.v);
    for (const neg of negatives) {
      for (const pos of positives) {
        if (neg.v === 0) break;
        if (pos.v === 0) continue;
        const amt = Math.min(neg.v, pos.v);
        out.push({ potId, fromId: pos.id, toId: neg.id, amountCents: amt });
        neg.v -= amt;
        pos.v -= amt;
      }
    }
  }
  return out;
}

/** Positivo: a le debe a b. Negativo: b le debe a a. */
export function ledgerNet(ledger: LedgerLite[], a: string, b: string): number {
  let net = 0;
  for (const r of ledger) {
    if (r.debtorId === a && r.creditorId === b) net += r.amountCents;
    else if (r.debtorId === b && r.creditorId === a) net -= r.amountCents;
  }
  return net;
}

export type PairBalance = {
  /** quien debe pagar (en neto) */
  fromId: string;
  toId: string;
  /** centavos netos que fromId le tiene que pasar a toId */
  netCents: number;
  /** deudas (gastos compartidos, préstamos, aportes): positivo = fromId debe */
  ledgerCents: number;
  /** entregas de bolsas pendientes entre los dos */
  deliveries: PotDelivery[];
};

/**
 * Balance neto entre dos personas: combina deudas y entregas de bolsas.
 * Devuelve null si están a mano.
 */
export function pairBalance(
  ledger: LedgerLite[],
  deliveries: PotDelivery[],
  a: string,
  b: string,
): PairBalance | null {
  const ledgerAB = ledgerNet(ledger, a, b);
  const between = deliveries.filter(
    (d) => (d.fromId === a && d.toId === b) || (d.fromId === b && d.toId === a),
  );
  const deliveriesAB = between.reduce(
    (acc, d) => acc + (d.fromId === a ? d.amountCents : -d.amountCents),
    0,
  );
  const net = ledgerAB + deliveriesAB;
  if (net === 0 && ledgerAB === 0 && between.length === 0) return null;
  const [fromId, toId, sign] = net >= 0 ? [a, b, 1] : [b, a, -1];
  return {
    fromId,
    toId,
    netCents: Math.abs(net),
    ledgerCents: ledgerAB * sign,
    deliveries: between,
  };
}

export type DebtLite = {
  id: string;
  debtorId: string;
  creditorId: string;
  amountCents: number;
};

export type DebtPaymentLite = { debtId: string; amountCents: number };

export function debtRemaining(debt: DebtLite, payments: DebtPaymentLite[]): number {
  const paid = payments
    .filter((p) => p.debtId === debt.id)
    .reduce((a, p) => a + p.amountCents, 0);
  return Math.max(0, debt.amountCents - paid);
}

/**
 * Reparte un pago de `payerId` a `payeeId` entre las deudas abiertas que
 * payer tiene con payee, de la más antigua a la más nueva (la lista debe venir
 * ordenada). Lo que sobra queda como pago general.
 */
export function allocatePayment(
  amountCents: number,
  payerId: string,
  payeeId: string,
  openDebts: DebtLite[],
  payments: DebtPaymentLite[],
): { allocations: { debtId: string; amountCents: number }[]; unallocatedCents: number } {
  let left = amountCents;
  const allocations: { debtId: string; amountCents: number }[] = [];
  for (const d of openDebts) {
    if (left <= 0) break;
    if (d.debtorId !== payerId || d.creditorId !== payeeId) continue;
    const rem = debtRemaining(d, payments);
    if (rem <= 0) continue;
    const amt = Math.min(rem, left);
    allocations.push({ debtId: d.id, amountCents: amt });
    left -= amt;
  }
  return { allocations, unallocatedCents: left };
}

/**
 * Para sacar `amountCents` de una bolsa hay que saber de qué custodios sale.
 * Se toma primero de quien más tiene.
 */
export function takeFromHolders(
  byMember: Record<string, number>,
  amountCents: number,
  preferredId?: string,
): { holderId: string; amountCents: number }[] {
  const entries = Object.entries(byMember)
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      if (a[0] === preferredId) return -1;
      if (b[0] === preferredId) return 1;
      return b[1] - a[1];
    });
  const out: { holderId: string; amountCents: number }[] = [];
  let left = amountCents;
  for (const [holderId, v] of entries) {
    if (left <= 0) break;
    const amt = Math.min(v, left);
    out.push({ holderId, amountCents: amt });
    left -= amt;
  }
  return out;
}
