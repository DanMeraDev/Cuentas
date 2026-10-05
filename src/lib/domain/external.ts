// Reparto de pagos de préstamos con gente de fuera de la casa.

/** Lo que le falta a cada miembro: su parte menos lo que ya se aplicó a su parte. */
export function externalRemaining(
  shares: { memberId: string; amountCents: number }[],
  paid: { memberId: string; amountCents: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of shares) out[s.memberId] = (out[s.memberId] ?? 0) + s.amountCents;
  for (const p of paid) out[p.memberId] = (out[p.memberId] ?? 0) - p.amountCents;
  for (const k of Object.keys(out)) if (out[k] < 0) out[k] = 0;
  return out;
}

/**
 * A qué parte se aplica un pago.
 * - "self-first": la persona paga con su plata; primero cubre su parte y lo
 *   que sobra cubre la de los demás (que quedan debiéndole).
 * - "even": sale de una bolsa de la casa; se reparte parejo entre quienes
 *   todavía deben.
 */
export function allocateExternal(
  remaining: Record<string, number>,
  amountCents: number,
  mode: "self-first" | "even",
  selfId?: string,
): Record<string, number> {
  const left = { ...remaining };
  const out: Record<string, number> = {};
  let rest = amountCents;
  const give = (id: string, amt: number) => {
    if (amt <= 0) return;
    out[id] = (out[id] ?? 0) + amt;
    left[id] -= amt;
    rest -= amt;
  };
  if (mode === "self-first") {
    if (selfId && left[selfId] > 0) give(selfId, Math.min(left[selfId], rest));
    for (const id of Object.keys(left)) if (rest > 0 && left[id] > 0) give(id, Math.min(left[id], rest));
    return out;
  }
  // parejo, sin pasarse de lo que le falta a cada uno
  while (rest > 0) {
    const open = Object.keys(left).filter((id) => left[id] > 0);
    if (!open.length) break;
    const each = Math.max(1, Math.floor(rest / open.length));
    for (const id of open) {
      if (rest <= 0) break;
      give(id, Math.min(each, left[id], rest));
    }
  }
  return out;
}
