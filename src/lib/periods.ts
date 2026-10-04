import {
  addMonths,
  addWeeks,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  setISOWeek,
  startOfISOWeek,
  endOfISOWeek,
} from "date-fns";
import { es } from "date-fns/locale";

export type Frequency = "weekly" | "monthly";

export const APP_TIMEZONE = "America/Guayaquil";

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la casa. */
export function todayISO(timeZone = APP_TIMEZONE, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toDate(iso: string): Date {
  return parseISO(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function weekKey(dateISO: string): string {
  const d = toDate(dateISO);
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

export function periodKey(dateISO: string, frequency: Frequency): string {
  return frequency === "weekly" ? weekKey(dateISO) : monthKey(dateISO);
}

/** Lunes de una semana ISO "2026-W40". */
export function weekStart(key: string): Date {
  const [y, w] = key.split("-W").map(Number);
  // el 4 de enero siempre cae en la semana 1 ISO
  return startOfISOWeek(setISOWeek(new Date(y, 0, 4, 12), w));
}

function periodStartDate(key: string): Date {
  return key.includes("-W") ? weekStart(key) : toDate(`${key}-01`);
}

function nextPeriod(key: string): string {
  if (key.includes("-W")) {
    return weekKey(format(addWeeks(weekStart(key), 1), "yyyy-MM-dd"));
  }
  return format(addMonths(toDate(`${key}-01`), 1), "yyyy-MM");
}

export function comparePeriods(a: string, b: string): number {
  return periodStartDate(a).getTime() - periodStartDate(b).getTime();
}

/** Períodos desde start hasta end (ambos incluidos). */
export function periodsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let p = start;
  while (comparePeriods(p, end) <= 0 && out.length < 1000) {
    out.push(p);
    p = nextPeriod(p);
  }
  return out;
}

export function previousPeriods(end: string, count: number): string[] {
  const out: string[] = [];
  let p = end;
  for (let i = 0; i < count; i++) {
    out.unshift(p);
    p = p.includes("-W")
      ? weekKey(format(addWeeks(weekStart(p), -1), "yyyy-MM-dd"))
      : format(addMonths(toDate(`${p}-01`), -1), "yyyy-MM");
  }
  return out;
}

/** "octubre 2026" o "semana del 28 sep" */
export function periodLabel(key: string, opts: { short?: boolean } = {}): string {
  if (key.includes("-W")) {
    const start = weekStart(key);
    const end = endOfISOWeek(start);
    if (opts.short) return `sem. ${format(start, "d MMM", { locale: es })}`;
    return `semana del ${format(start, "d MMM", { locale: es })} al ${format(end, "d MMM", { locale: es })}`;
  }
  const d = toDate(`${key}-01`);
  return format(d, opts.short ? "MMM yyyy" : "MMMM yyyy", { locale: es });
}

export function formatDay(dateISO: string, pattern = "d MMM"): string {
  return format(toDate(dateISO), pattern, { locale: es });
}

export function dayOfMonth(dateISO: string): number {
  return Number(dateISO.slice(8, 10));
}
