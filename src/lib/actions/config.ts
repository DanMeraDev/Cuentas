"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { actionContext, getUser, loadContext } from "@/lib/auth";
import { MEMBER_COLORS } from "@/lib/colors";
import { SUGGESTED_POTS } from "@/lib/defaults";
import { issueToken } from "@/lib/tokens";
import { parseAmountToCents } from "@/lib/money";
import { monthKey, periodKey, todayISO } from "@/lib/periods";
import { attempt, fail, ok, UserError, type ActionResult } from "./result";

const color = z.enum(MEMBER_COLORS);

function cents(value: FormDataEntryValue | null, label: string): number {
  const c = parseAmountToCents(typeof value === "string" ? value : null);
  if (c === null || c < 0) throw new UserError(`Revisa el monto de «${label}».`);
  return c;
}

async function bumpStep(householdId: string, step: number) {
  const h = await db.query.households.findFirst({ where: eq(schema.households.id, householdId) });
  if (h && h.setupStep < step) {
    await db.update(schema.households).set({ setupStep: step }).where(eq(schema.households.id, householdId));
  }
}

/** Después de guardar: en el asistente avanza de paso; en Ajustes se queda. */
function after(form: FormData, nextStep: number, message: string): ActionResult {
  revalidatePath("/", "layout");
  if (form.get("wizard") === "1") redirect(`/bienvenida?paso=${nextStep}`);
  return ok(message);
}

// ---------------------------------------------------------------------------
// Paso 1: la casa y sus miembros
// ---------------------------------------------------------------------------

export async function saveHousehold(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const parsed = z
      .object({
        name: z.string().trim().min(1, "Ponle un nombre a la casa"),
        myName: z.string().trim().min(1, "Escribe tu nombre"),
        myColor: color,
        otherName: z.string().trim().min(1, "Escribe el nombre de la otra persona"),
        otherColor: color,
      })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const v = parsed.data;
    if (v.myColor === v.otherColor) return fail("Elijan colores distintos para diferenciarse.");

    const ctx = await loadContext();
    if (ctx) {
      await db.update(schema.households).set({ name: v.name }).where(eq(schema.households.id, ctx.household.id));
      await db.update(schema.members).set({ name: v.myName, color: v.myColor }).where(eq(schema.members.id, ctx.me.id));
      const other = ctx.others[0];
      if (other) {
        await db.update(schema.members).set({ name: v.otherName, color: v.otherColor }).where(eq(schema.members.id, other.id));
      } else {
        await db.insert(schema.members).values({ householdId: ctx.household.id, name: v.otherName, color: v.otherColor });
      }
      await bumpStep(ctx.household.id, 2);
      return after(form, 2, "Guardado.");
    }

    const user = await getUser();
    if (!user) throw new Error("Sin sesión");
    const [{ value }] = await db.select({ value: count() }).from(schema.households);
    if (value > 0) return fail("Esta app ya tiene una casa. Usa el enlace de invitación.");

    await db.transaction(async (tx) => {
      const [household] = await tx
        .insert(schema.households)
        .values({ name: v.name, inviteCode: randomBytes(9).toString("base64url"), setupStep: 2 })
        .returning();
      await tx.insert(schema.members).values([
        { householdId: household.id, userId: user.id, name: v.myName, color: v.myColor },
        { householdId: household.id, name: v.otherName, color: v.otherColor },
      ]);
    });
    revalidatePath("/", "layout");
    redirect("/bienvenida?paso=2");
  });
}

export async function updateMember(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const parsed = z
      .object({ memberId: z.string().uuid(), name: z.string().trim().min(1, "Escribe un nombre"), color })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    if (!ctx.members.some((m) => m.id === parsed.data.memberId)) return fail("Miembro no encontrado.");
    await db
      .update(schema.members)
      .set({ name: parsed.data.name, color: parsed.data.color })
      .where(eq(schema.members.id, parsed.data.memberId));
    revalidatePath("/", "layout");
    return ok("Guardado.");
  });
}

// ---------------------------------------------------------------------------
// Paso 2: bolsas
// ---------------------------------------------------------------------------

export async function saveWizardPots(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const existing = await db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id) });
    const toCreate: (typeof schema.pots.$inferInsert)[] = [];
    SUGGESTED_POTS.forEach((p, i) => {
      if (form.get(`pot_${p.key}`) && !existing.some((e) => e.kind === p.kind)) {
        toCreate.push({ householdId: ctx.household.id, name: p.name, emoji: p.emoji, kind: p.kind, sortOrder: i });
      }
    });
    const customName = String(form.get("customName") ?? "").trim();
    if (customName) {
      toCreate.push({
        householdId: ctx.household.id,
        name: customName,
        emoji: String(form.get("customEmoji") ?? "").trim() || "💰",
        kind: "other",
        sortOrder: 10 + existing.length,
      });
    }
    if (toCreate.length) await db.insert(schema.pots).values(toCreate);
    if (existing.length + toCreate.length === 0) return fail("Crea al menos una bolsa.");
    await bumpStep(ctx.household.id, 3);
    return after(form, 3, "Bolsas guardadas.");
  });
}

export async function savePot(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const parsed = z
      .object({
        potId: z.string().optional(),
        name: z.string().trim().min(1, "Ponle nombre a la bolsa"),
        emoji: z.string().trim().max(8).optional(),
        kind: z.enum(["rent", "food", "services", "other"]).default("other"),
      })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const v = parsed.data;
    if (v.potId) {
      await db
        .update(schema.pots)
        .set({ name: v.name, emoji: v.emoji || "💰", kind: v.kind })
        .where(and(eq(schema.pots.id, v.potId), eq(schema.pots.householdId, ctx.household.id)));
    } else {
      await db.insert(schema.pots).values({ householdId: ctx.household.id, name: v.name, emoji: v.emoji || "💰", kind: v.kind, sortOrder: 50 });
    }
    revalidatePath("/", "layout");
    return ok("Bolsa guardada.");
  });
}

// ---------------------------------------------------------------------------
// Paso 3: arriendo
// ---------------------------------------------------------------------------

export async function saveRent(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    if (form.get("noRent") === "1") {
      await db
        .update(schema.rentConfig)
        .set({ active: false })
        .where(eq(schema.rentConfig.householdId, ctx.household.id));
      await bumpStep(ctx.household.id, 4);
      return after(form, 4, "Listo.");
    }
    const potId = String(form.get("potId") ?? "");
    const pot = await db.query.pots.findFirst({
      where: and(eq(schema.pots.id, potId), eq(schema.pots.householdId, ctx.household.id)),
    });
    if (!pot) return fail("Elige la bolsa del arriendo.");
    const totalCents = cents(form.get("total"), "Total del arriendo");
    if (totalCents <= 0) return fail("El arriendo tiene que ser mayor a $0.");
    const payerId = String(form.get("payerId") ?? "");
    if (!ctx.members.some((m) => m.id === payerId)) return fail("Elige quién le paga al dueño.");
    const dueDay = Math.min(31, Math.max(1, Number(form.get("dueDay")) || 1));

    const shares = ctx.members.map((m) => ({
      householdId: ctx.household.id,
      memberId: m.id,
      amountCents: cents(form.get(`share_${m.id}`), `Parte de ${m.name}`),
    }));

    const start = monthKey(todayISO(ctx.household.timezone));
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.rentConfig)
        .values({ householdId: ctx.household.id, totalCents, potId, payerId, dueDay, startPeriod: start, active: true })
        .onConflictDoUpdate({
          target: schema.rentConfig.householdId,
          set: { totalCents, potId, payerId, dueDay, active: true },
        });
      await tx.delete(schema.rentShares).where(eq(schema.rentShares.householdId, ctx.household.id));
      await tx.insert(schema.rentShares).values(shares);
    });
    await bumpStep(ctx.household.id, 4);
    return after(form, 4, "Arriendo guardado.");
  });
}

// ---------------------------------------------------------------------------
// Paso 4: aportes (plata que llega de fuera)
// ---------------------------------------------------------------------------

const lineSchema = z.object({
  label: z.string().trim().min(1, "Cada parte necesita un nombre"),
  amount: z.string(),
  dest: z.string().regex(/^(pot|member):[0-9a-f-]{36}$/, "Elige a dónde va cada parte"),
});

export async function saveContribution(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const parsed = z
      .object({
        contributionId: z.string().optional(),
        name: z.string().trim().min(1, "Ponle un nombre al aporte"),
        source: z.string().trim().min(1, "¿Quién da esta plata?"),
        frequency: z.enum(["weekly", "monthly"]),
        defaultReceiverId: z.string().optional(),
        lines: z.string(),
      })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const v = parsed.data;

    let rawLines: unknown;
    try {
      rawLines = JSON.parse(v.lines);
    } catch {
      return fail("Revisa las partes del aporte.");
    }
    const lines = z.array(lineSchema).min(1, "Agrega al menos una parte").safeParse(rawLines);
    if (!lines.success) return fail(lines.error.issues[0].message);

    const pots = await db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id) });
    const rows = lines.data.map((l, i) => {
      const [dest, refId] = l.dest.split(":");
      if (dest === "pot" && !pots.some((p) => p.id === refId)) throw new UserError("Bolsa no encontrada.");
      if (dest === "member" && !ctx.members.some((m) => m.id === refId)) throw new UserError("Miembro no encontrado.");
      return {
        label: l.label,
        amountCents: cents(l.amount, l.label),
        dest,
        potId: dest === "pot" ? refId : null,
        memberId: dest === "member" ? refId : null,
        sortOrder: i,
      };
    });

    const receiver = ctx.members.find((m) => m.id === v.defaultReceiverId)?.id ?? null;
    const start = periodKey(todayISO(ctx.household.timezone), v.frequency);

    await db.transaction(async (tx) => {
      let contributionId = v.contributionId;
      if (contributionId) {
        const existing = await tx.query.contributions.findFirst({
          where: and(eq(schema.contributions.id, contributionId), eq(schema.contributions.householdId, ctx.household.id)),
        });
        if (!existing) throw new UserError("Aporte no encontrado.");
        if (existing.frequency !== v.frequency) {
          throw new UserError("No se puede cambiar la frecuencia de un aporte existente. Crea uno nuevo.");
        }
        await tx
          .update(schema.contributions)
          .set({ name: v.name, source: v.source, defaultReceiverId: receiver })
          .where(eq(schema.contributions.id, contributionId));
        await tx.delete(schema.contributionLines).where(eq(schema.contributionLines.contributionId, contributionId));
      } else {
        const [c] = await tx
          .insert(schema.contributions)
          .values({
            householdId: ctx.household.id,
            name: v.name,
            source: v.source,
            frequency: v.frequency,
            defaultReceiverId: receiver,
            startPeriod: start,
          })
          .returning();
        contributionId = c.id;
      }
      await tx.insert(schema.contributionLines).values(rows.map((r) => ({ ...r, contributionId: contributionId! })));
    });
    revalidatePath("/", "layout");
    if (form.get("wizard") === "1") redirect("/bienvenida?paso=4");
    if (form.get("back")) redirect(String(form.get("back")));
    return ok("Aporte guardado.");
  });
}

export async function toggleContribution(form: FormData) {
  const ctx = await actionContext();
  const id = String(form.get("id"));
  const active = form.get("active") === "1";
  await db
    .update(schema.contributions)
    .set({ active })
    .where(and(eq(schema.contributions.id, id), eq(schema.contributions.householdId, ctx.household.id)));
  revalidatePath("/", "layout");
}

export async function deleteContribution(form: FormData) {
  const ctx = await actionContext();
  const id = String(form.get("id"));
  const used = await db.query.contributionReceipts.findFirst({
    where: eq(schema.contributionReceipts.contributionId, id),
  });
  if (used) {
    // ya tiene historial: solo se desactiva para no perder registros
    await db.update(schema.contributions).set({ active: false })
      .where(and(eq(schema.contributions.id, id), eq(schema.contributions.householdId, ctx.household.id)));
  } else {
    await db.delete(schema.contributions)
      .where(and(eq(schema.contributions.id, id), eq(schema.contributions.householdId, ctx.household.id)));
  }
  revalidatePath("/", "layout");
}

export async function wizardNext(form: FormData) {
  const ctx = await actionContext();
  const step = Number(form.get("step"));
  await bumpStep(ctx.household.id, step);
  redirect(`/bienvenida?paso=${step}`);
}

// ---------------------------------------------------------------------------
// Paso 5: servicios
// ---------------------------------------------------------------------------

export async function saveService(_: ActionResult, form: FormData): Promise<ActionResult> {
  return attempt(async () => {
    const ctx = await actionContext();
    const parsed = z
      .object({
        serviceId: z.string().optional(),
        name: z.string().trim().min(1, "Ponle nombre al servicio"),
        emoji: z.string().trim().max(8).optional(),
        potId: z.string().uuid("Elige de qué bolsa se paga"),
        accumulable: z.string().optional(),
      })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const v = parsed.data;
    const pot = await db.query.pots.findFirst({
      where: and(eq(schema.pots.id, v.potId), eq(schema.pots.householdId, ctx.household.id)),
    });
    if (!pot) return fail("Bolsa no encontrada.");
    const values = { name: v.name, emoji: v.emoji || "🧾", potId: v.potId, accumulable: v.accumulable === "on" };
    if (v.serviceId) {
      await db.update(schema.services).set(values)
        .where(and(eq(schema.services.id, v.serviceId), eq(schema.services.householdId, ctx.household.id)));
    } else {
      await db.insert(schema.services).values({
        ...values,
        householdId: ctx.household.id,
        startPeriod: monthKey(todayISO(ctx.household.timezone)),
      });
    }
    revalidatePath("/", "layout");
    if (form.get("wizard") === "1") redirect("/bienvenida?paso=5");
    return ok("Servicio guardado.");
  });
}

export async function deleteService(form: FormData) {
  const ctx = await actionContext();
  const id = String(form.get("id"));
  const used = await db.query.servicePayments.findFirst({ where: eq(schema.servicePayments.serviceId, id) });
  if (used) {
    await db.update(schema.services).set({ active: false })
      .where(and(eq(schema.services.id, id), eq(schema.services.householdId, ctx.household.id)));
  } else {
    await db.delete(schema.services)
      .where(and(eq(schema.services.id, id), eq(schema.services.householdId, ctx.household.id)));
  }
  revalidatePath("/", "layout");
}

export async function finishSetup() {
  const ctx = await actionContext();
  await db.update(schema.households).set({ setupDone: true, setupStep: 6 }).where(eq(schema.households.id, ctx.household.id));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function regenerateInvite() {
  const ctx = await actionContext();
  await db
    .update(schema.households)
    .set({ inviteCode: randomBytes(9).toString("base64url") })
    .where(eq(schema.households.id, ctx.household.id));
  revalidatePath("/", "layout");
}

export async function createShortcutToken(): Promise<string> {
  const ctx = await actionContext();
  return issueToken(ctx.me.id);
}
