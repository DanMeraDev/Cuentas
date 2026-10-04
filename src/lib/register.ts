import "server-only";
import { addMonths, format, parseISO } from "date-fns";
import type { AppContext } from "./auth";
import type { ExtractionT } from "./ai";
import type { HouseState } from "./queries";
import type { RegisterDefaults } from "@/components/RegisterForm";
import { periodLabel, previousPeriods } from "./periods";
import { CATEGORIES } from "./defaults";

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Arma los datos del formulario de registro a partir de lo que leyó la IA. */
export function registerProps(ctx: AppContext, house: HouseState, x: ExtractionT | null, fileId: string | null) {
  const service =
    house.services.find((s) => norm(s.service.name) === norm(x?.service_name)) ??
    house.services.find((s) => x?.service_name && norm(x.service_name).includes(norm(s.service.name)));
  const pot = house.pots.find((p) => norm(p.name) === norm(x?.pot_name));
  const debtOther = ctx.others.find((m) => norm(m.name) === norm(x?.debt_person));

  let type: RegisterDefaults["type"] = "expense";
  let scope: RegisterDefaults["scope"] = "personal";
  switch (x?.suggestion) {
    case "service":
      type = house.services.length ? "service" : "expense";
      break;
    case "rent":
      type = house.rent && !house.rent.payment ? "rent" : "expense";
      break;
    case "debt":
      type = "debt";
      break;
    case "shared":
      scope = "shared";
      break;
    case "pot":
      scope = "pot";
      break;
  }

  const nextMonth = format(addMonths(parseISO(`${house.month}-15`), 1), "yyyy-MM");
  const services = house.services.map((s) => {
    const values = Array.from(new Set([...s.status.pending, ...previousPeriods(house.month, 3), nextMonth])).sort();
    let preselected = s.service.accumulable ? s.status.pending : s.status.pending.slice(0, 1);
    if (s === service && x?.billing_period && values.includes(x.billing_period)) preselected = [x.billing_period];
    return {
      id: s.service.id,
      name: s.service.name,
      emoji: s.service.emoji,
      choices: values.map((v) => ({ value: v, label: periodLabel(v, { short: true }) })),
      preselected,
    };
  });

  const defaults: RegisterDefaults = {
    type,
    scope,
    amount: x?.amount != null ? x.amount.toFixed(2) : "",
    date: x?.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date <= house.today ? x.date : house.today,
    description: x?.description ?? "",
    merchant: x?.merchant ?? "",
    category: CATEGORIES.some((c) => c.key === x?.category) ? x!.category : "otros",
    potId: pot?.id ?? null,
    serviceId: service?.service.id ?? null,
    debtOtherId: debtOther?.id ?? null,
  };

  return {
    fileId,
    defaults,
    members: ctx.members.map((m) => ({ id: m.id, name: m.name })),
    meId: ctx.me.id,
    pots: house.pots.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, kind: p.kind, totalCents: p.totalCents })),
    services,
    rent: {
      available: !!house.rent,
      paid: !!house.rent?.payment,
      payerId: house.rent?.payerId ?? null,
      totalCents: house.rent?.totalCents ?? 0,
    },
    today: house.today,
  };
}
