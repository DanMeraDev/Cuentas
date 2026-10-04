import { describe, expect, it } from "vitest";
import {
  allocatePayment,
  pairBalance,
  potDeliveries,
  potHoldings,
  potTotal,
  takeFromHolders,
} from "./balances";
import { serviceStatus } from "./services";
import { rentSummary, setAsideNotice } from "./rent";
import { formatCents, parseAmountToCents, splitEvenly } from "../money";
import { periodLabel, periodsBetween, weekKey, todayISO, previousPeriods } from "../periods";

const A = "a"; // quien recibe los aportes
const B = "b"; // quien paga al dueño
const RENT = "rent";
const FOOD = "food";
const SERV = "serv";

describe("dinero", () => {
  it("formatea y parsea montos", () => {
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(-500)).toBe("-$5.00");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(parseAmountToCents("12,50")).toBe(1250);
    expect(parseAmountToCents("$1,234.50")).toBe(123450);
    expect(parseAmountToCents("1.234,50")).toBe(123450);
    expect(parseAmountToCents("40")).toBe(4000);
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents(14.75)).toBe(1475);
  });
  it("divide sin perder centavos", () => {
    expect(splitEvenly(1001, 2)).toEqual([501, 500]);
    expect(splitEvenly(1500, 2)).toEqual([750, 750]);
  });
});

describe("períodos", () => {
  it("calcula semanas ISO y rangos", () => {
    expect(weekKey("2026-10-04")).toBe("2026-W40");
    expect(weekKey("2026-12-31")).toBe("2026-W53");
    expect(periodsBetween("2026-08", "2026-10")).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(periodsBetween("2026-W52", "2027-W02")).toEqual([
      "2026-W52",
      "2026-W53",
      "2027-W01",
      "2027-W02",
    ]);
    expect(previousPeriods("2026-10", 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(periodLabel("2026-10")).toBe("octubre 2026");
  });
  it("usa la hora de Ecuador", () => {
    // 2 de octubre 03:00 UTC = 1 de octubre 22:00 en Guayaquil
    expect(todayISO("America/Guayaquil", new Date("2026-10-02T03:00:00Z"))).toBe("2026-10-01");
  });
});

describe("arriendo de un mes completo", () => {
  // Mamá $250 (recibe A), garaje $40 (recibe B), partes A $150 y B $110,
  // B paga $550 al dueño.
  const movements = [
    { potId: RENT, holderId: A, amountCents: 25000 }, // aporte mamá
    { potId: RENT, holderId: B, amountCents: 4000 }, // garaje
    { potId: RENT, holderId: A, amountCents: 15000 }, // A aparta su parte
    { potId: RENT, holderId: B, amountCents: 11000 }, // B aparta su parte
  ];

  it("antes de pagar nadie le debe a nadie, solo hay custodia", () => {
    const h = potHoldings(movements);
    expect(potTotal(h, RENT)).toBe(55000);
    expect(h[RENT]).toEqual({ a: 40000, b: 15000 });
    expect(potDeliveries(h)).toEqual([]);
  });

  it("cuando B paga, A le debe entregar $400", () => {
    const h = potHoldings([...movements, { potId: RENT, holderId: B, amountCents: -55000 }]);
    expect(potTotal(h, RENT)).toBe(0);
    expect(potDeliveries(h)).toEqual([
      { potId: RENT, fromId: A, toId: B, amountCents: 40000 },
    ]);
    const bal = pairBalance([], potDeliveries(h), A, B);
    expect(bal).toMatchObject({ fromId: A, toId: B, netCents: 40000 });
  });

  it("si B se gasta el garaje en la casa, falta plata en la bolsa", () => {
    const h = potHoldings([
      ...movements,
      { potId: RENT, holderId: B, amountCents: -4000 }, // gasto de la casa desde la bolsa
    ]);
    expect(potTotal(h, RENT)).toBe(51000); // faltan $40 para los $550
  });
});

describe("bolsas de comida y servicios", () => {
  it("si B compra del súper con su plata y A tiene la plata de comida, A le entrega", () => {
    const h = potHoldings([
      { potId: FOOD, holderId: A, amountCents: 4000 },
      { potId: FOOD, holderId: B, amountCents: -3000 },
    ]);
    expect(potTotal(h, FOOD)).toBe(1000); // sobran $10
    expect(potDeliveries(h)).toEqual([{ potId: FOOD, fromId: A, toId: B, amountCents: 3000 }]);
  });

  it("faltante de servicios cubierto 50/50 deja a B debiendo la mitad", () => {
    const h = potHoldings([
      { potId: SERV, holderId: A, amountCents: 10000 }, // papá
      { potId: SERV, holderId: A, amountCents: -11500 }, // A paga servicios por $115
      { potId: SERV, holderId: A, amountCents: 750 }, // cubre su mitad
      { potId: SERV, holderId: B, amountCents: 750 }, // mitad de B (sigue en manos de B)
    ]);
    expect(potTotal(h, SERV)).toBe(0);
    expect(potDeliveries(h)).toEqual([{ potId: SERV, fromId: B, toId: A, amountCents: 750 }]);
  });

  it("toma plata de los custodios empezando por quien más tiene", () => {
    expect(takeFromHolders({ a: 500, b: 2000 }, 2200)).toEqual([
      { holderId: B, amountCents: 2000 },
      { holderId: A, amountCents: 200 },
    ]);
    expect(takeFromHolders({ a: 500, b: 2000 }, 300, A)).toEqual([{ holderId: A, amountCents: 300 }]);
  });
});

describe("deudas", () => {
  it("combina gastos compartidos, aportes y entregas de bolsas", () => {
    const ledger = [
      { debtorId: B, creditorId: A, amountCents: 750 }, // pizza 50/50 pagada por A
      { debtorId: A, creditorId: B, amountCents: 2500 }, // A recibió los $25 de B
    ];
    const deliveries = [{ potId: FOOD, fromId: B, toId: A, amountCents: 1000 }];
    // A debe 25 - 7.50 = 17.50 por deudas; B debe entregar 10 → neto A debe 7.50
    expect(pairBalance(ledger, deliveries, A, B)).toMatchObject({
      fromId: A,
      toId: B,
      netCents: 750,
      ledgerCents: 1750,
    });
    expect(pairBalance([], [], A, B)).toBeNull();
  });

  it("reparte un abono entre deudas abiertas, de la más antigua a la más nueva", () => {
    const debts = [
      { id: "d1", debtorId: B, creditorId: A, amountCents: 4000 },
      { id: "d2", debtorId: B, creditorId: A, amountCents: 200 },
    ];
    expect(allocatePayment(4100, B, A, debts, [{ debtId: "d1", amountCents: 1000 }])).toEqual({
      allocations: [
        { debtId: "d1", amountCents: 3000 },
        { debtId: "d2", amountCents: 200 },
      ],
      unallocatedCents: 900,
    });
  });
});

describe("servicios", () => {
  it("internet sin pagar en septiembre queda pendiente y se estima la reserva", () => {
    const s = serviceStatus("2026-08", "2026-10", [
      { periods: ["2026-08"], amountCents: 2500, paidOn: "2026-08-10" },
    ]);
    expect(s.pending).toEqual(["2026-09", "2026-10"]);
    expect(s.overdue).toEqual(["2026-09"]);
    expect(s.committedCents).toBe(5000);
  });
  it("un pago que cubre dos meses estima por mes", () => {
    const s = serviceStatus("2026-08", "2026-10", [
      { periods: ["2026-08"], amountCents: 2500, paidOn: "2026-08-10" },
      { periods: ["2026-09", "2026-10"], amountCents: 5200, paidOn: "2026-10-05" },
    ]);
    expect(s.pending).toEqual([]);
    expect(s.paidCurrent).toBe(true);
    expect(s.estimateCents).toBe(2600);
  });
});

describe("mensajes del arriendo", () => {
  const members = [
    { id: A, name: "Ana" },
    { id: B, name: "Beto" },
  ];
  const base = {
    members,
    shares: { a: 15000, b: 11000 },
    payerId: B,
    totalCents: 55000,
    lines: [
      { key: "mama", label: "Aporte de Mamá", amountCents: 25000, receivedBy: A, receivedOn: "2026-10-01", skipped: false },
      { key: "garaje", label: "Garaje", amountCents: 4000, receivedBy: null, receivedOn: null, skipped: false },
    ],
    payment: null,
    holdings: { a: 40000, b: 0 },
  };

  it("avisa a quien le falta su parte", () => {
    const s = rentSummary({ ...base, viewerId: B, marks: [{ memberId: A, kind: "set_aside" }] });
    expect(s.headline).toBe("Ana ya tiene su parte. Falta la tuya y pagar el arriendo.");
    expect(s.missing).toEqual(["Garaje"]);
    expect(s.toDeliver).toEqual([{ fromId: A, toId: B, amountCents: 40000 }]);
    expect(s.configuredCents).toBe(55000);
    expect(setAsideNotice("Ana", B, s)).toBe("Ana ya tiene su parte. Falta la tuya y pagar el arriendo.");
  });

  it("cuando las dos partes están, solo falta pagar", () => {
    const s = rentSummary({
      ...base,
      viewerId: A,
      marks: [
        { memberId: A, kind: "set_aside" },
        { memberId: B, kind: "set_aside" },
      ],
    });
    expect(s.headline).toBe("Ya están todas las partes. Solo falta pagar el arriendo.");
  });

  it("desde el lado de quien ya apartó", () => {
    const s = rentSummary({ ...base, viewerId: A, marks: [{ memberId: A, kind: "set_aside" }] });
    expect(s.headline).toBe("Ya tienes tu parte. Falta la de Beto y pagar el arriendo.");
  });

  it("cuando no hay ninguna parte", () => {
    const s = rentSummary({ ...base, viewerId: A, marks: [] });
    expect(s.headline).toBe("Falta tu parte y la de Beto, y pagar el arriendo.");
  });

  it("pagado", () => {
    const s = rentSummary({
      ...base,
      viewerId: A,
      marks: [
        { memberId: A, kind: "delivered" },
        { memberId: B, kind: "set_aside" },
      ],
      payment: { paidBy: B, paidOn: "2026-10-05" },
    });
    expect(s.headline).toBe("Arriendo pagado ✅");
    expect(s.toDeliver).toEqual([]);
  });
});
