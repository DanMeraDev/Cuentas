import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { contextFromRequest } from "@/lib/tokens";
import { db, schema } from "@/lib/db";
import { recordExpense } from "@/lib/expense";
import { CATEGORIES } from "@/lib/defaults";
import { formatCents, splitEvenly } from "@/lib/money";
import { todayISO } from "@/lib/periods";
import type { ExtractionT } from "@/lib/ai";

/**
 * Segundo paso del atajo: la persona eligió en el menú qué es la captura.
 * opcion: "personal" | "compartido" | "comida" | "despues"
 */
export async function POST(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  let body: { id?: string; opcion?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const file = await db.query.files.findFirst({
    where: and(eq(schema.files.id, body.id ?? ""), eq(schema.files.householdId, ctx.household.id)),
  });
  if (!file || file.draftStatus !== "pending") return NextResponse.json({ mensaje: "Esa captura ya no está pendiente." });

  const x = file.aiResult as ExtractionT | null;
  const opcion = body.opcion ?? "despues";
  if (opcion === "despues" || !x?.amount) {
    return NextResponse.json({ mensaje: "Queda pendiente: confírmala en la app (Registrar → Por confirmar)." });
  }

  const amount = Math.round(x.amount * 100);
  const today = todayISO(ctx.household.timezone);
  const occurredOn = x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date <= today ? x.date : today;
  const category = CATEGORIES.some((c) => c.key === x.category) ? x.category : "otros";
  const base = {
    amount,
    occurredOn,
    description: x.description || x.merchant || "Gasto",
    merchant: x.merchant,
    category,
    paidBy: ctx.me,
    fileId: file.id,
  };

  if (opcion === "personal") {
    await recordExpense(ctx, { ...base, scope: "personal", shares: [], pot: null });
    return NextResponse.json({ mensaje: `Guardado como gasto tuyo: ${formatCents(amount)}.` });
  }
  if (opcion === "compartido") {
    const parts = splitEvenly(amount, ctx.members.length);
    await recordExpense(ctx, {
      ...base,
      scope: "shared",
      shares: [ctx.me, ...ctx.others].map((m, i) => ({ memberId: m.id, amountCents: parts[i] })),
      pot: null,
    });
    return NextResponse.json({ mensaje: `Gasto compartido de ${formatCents(amount)}: a cada uno le toca ${formatCents(parts[0])}.` });
  }
  if (opcion === "comida") {
    const pot = await db.query.pots.findFirst({
      where: and(eq(schema.pots.householdId, ctx.household.id), eq(schema.pots.kind, "food"), eq(schema.pots.archived, false)),
    });
    if (!pot) return NextResponse.json({ mensaje: "No hay bolsa de comida. Confírmala en la app." });
    await recordExpense(ctx, { ...base, scope: "pot", shares: [], pot });
    return NextResponse.json({ mensaje: `Pagado de ${pot.name}: ${formatCents(amount)}.` });
  }
  return NextResponse.json({ error: "Opción no válida" }, { status: 400 });
}
