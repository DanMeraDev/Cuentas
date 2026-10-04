// Estado del arriendo de un mes: quién ya tiene su parte, qué aportes llegaron
// y qué falta. Lógica pura para poder probarla.

export type RentMember = { id: string; name: string };

export type RentContributionLine = {
  key: string;
  label: string;
  amountCents: number;
  receivedBy: string | null;
  receivedOn: string | null;
  skipped: boolean;
};

export type ShareState = "pending" | "set_aside" | "delivered";

export type RentInput = {
  viewerId: string;
  members: RentMember[];
  shares: Record<string, number>;
  payerId: string | null;
  totalCents: number;
  lines: RentContributionLine[];
  marks: { memberId: string; kind: "set_aside" | "delivered" }[];
  payment: { paidBy: string; paidOn: string } | null;
  /** lo que cada miembro tiene hoy de la bolsa del arriendo */
  holdings: Record<string, number>;
};

export type RentSummary = {
  shareStates: Record<string, ShareState>;
  headline: string;
  missing: string[];
  /** quién tiene plata del arriendo que todavía no le pasó a quien paga */
  toDeliver: { fromId: string; toId: string; amountCents: number }[];
  configuredCents: number;
  paid: boolean;
};

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export function rentSummary(input: RentInput): RentSummary {
  const { viewerId, members, shares, payerId, lines, marks, payment, holdings } = input;
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Alguien";

  const shareStates: Record<string, ShareState> = {};
  for (const m of members) {
    if (!(m.id in shares)) continue;
    const delivered = marks.some((k) => k.memberId === m.id && k.kind === "delivered");
    const setAside = marks.some((k) => k.memberId === m.id && k.kind === "set_aside");
    shareStates[m.id] = delivered ? "delivered" : setAside ? "set_aside" : "pending";
  }

  const pendingShares = Object.entries(shareStates)
    .filter(([, s]) => s === "pending")
    .map(([id]) => id);
  const pendingLines = lines.filter((l) => !l.receivedBy && !l.skipped);

  const missing: string[] = [];
  for (const l of pendingLines) missing.push(l.label);

  const toDeliver: RentSummary["toDeliver"] = [];
  if (payerId && !payment) {
    for (const m of members) {
      if (m.id === payerId) continue;
      const h = holdings[m.id] ?? 0;
      if (h > 0) toDeliver.push({ fromId: m.id, toId: payerId, amountCents: h });
    }
  }

  let headline: string;
  if (payment) {
    headline =
      pendingShares.length > 0
        ? `Arriendo pagado por ${name(payment.paidBy)}. Falta la parte de ${joinNames(pendingShares.map(name))}.`
        : `Arriendo pagado ✅`;
  } else {
    const others = pendingShares.filter((id) => id !== viewerId);
    const viewerPending = pendingShares.includes(viewerId);
    const readyOthers = Object.keys(shareStates).filter(
      (id) => id !== viewerId && !pendingShares.includes(id),
    );
    if (pendingShares.length === 0) {
      headline = "Ya están todas las partes. Solo falta pagar el arriendo.";
    } else if (viewerPending && others.length === 0) {
      headline =
        readyOthers.length > 0
          ? `${joinNames(readyOthers.map(name))} ya tiene su parte. Falta la tuya y pagar el arriendo.`
          : "Falta tu parte y pagar el arriendo.";
    } else if (!viewerPending && viewerId in shareStates) {
      headline = `Ya tienes tu parte. Falta la de ${joinNames(others.map(name))} y pagar el arriendo.`;
    } else if (viewerPending) {
      headline = `Falta tu parte y la de ${joinNames(others.map(name))}, y pagar el arriendo.`;
    } else {
      headline = `Falta la parte de ${joinNames(pendingShares.map(name))} y pagar el arriendo.`;
    }
  }

  const configuredCents =
    Object.values(shares).reduce((a, b) => a + b, 0) +
    lines.reduce((a, l) => a + l.amountCents, 0);

  return {
    shareStates,
    headline,
    missing,
    toDeliver,
    configuredCents,
    paid: !!payment,
  };
}

/** Texto del aviso que recibe el otro cuando alguien marca "ya tengo mi parte". */
export function setAsideNotice(
  actorName: string,
  recipientId: string,
  summary: RentSummary,
): string {
  const recipientPending = summary.shareStates[recipientId] === "pending";
  const anyPending = Object.values(summary.shareStates).includes("pending");
  if (summary.paid) return `${actorName} ya tiene su parte del arriendo.`;
  if (recipientPending) return `${actorName} ya tiene su parte. Falta la tuya y pagar el arriendo.`;
  if (!anyPending) return `${actorName} ya tiene su parte. Ya están todas; solo falta pagar el arriendo.`;
  return `${actorName} ya tiene su parte del arriendo.`;
}
