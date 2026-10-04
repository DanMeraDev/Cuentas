import { comparePeriods, periodsBetween } from "../periods";

export type ServicePaymentLite = {
  periods: string[];
  amountCents: number;
  paidOn: string;
};

export type ServiceStatus = {
  /** meses sin pagar hasta el mes actual (incluido) */
  pending: string[];
  /** meses anteriores al actual que siguen sin pagar */
  overdue: string[];
  paidCurrent: boolean;
  /** estimado por mes según el último pago (0 si no hay historial) */
  estimateCents: number;
  /** lo que habría que reservar para los meses pendientes */
  committedCents: number;
};

export function serviceStatus(
  startPeriod: string,
  currentPeriod: string,
  payments: ServicePaymentLite[],
): ServiceStatus {
  const paid = new Set(payments.flatMap((p) => p.periods));
  const all =
    comparePeriods(startPeriod, currentPeriod) <= 0
      ? periodsBetween(startPeriod, currentPeriod)
      : [];
  const pending = all.filter((p) => !paid.has(p));
  const overdue = pending.filter((p) => p !== currentPeriod);

  const last = [...payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn))[0];
  const estimateCents = last
    ? Math.round(last.amountCents / Math.max(1, last.periods.length))
    : 0;

  return {
    pending,
    overdue,
    paidCurrent: paid.has(currentPeriod),
    estimateCents,
    committedCents: estimateCents * pending.length,
  };
}
