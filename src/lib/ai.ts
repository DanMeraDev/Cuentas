import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { downloadReceipt } from "./storage";
import { CATEGORIES } from "./defaults";
import { todayISO } from "./periods";
import type { AppContext } from "./auth";

const categoryKeys = CATEGORIES.map((c) => c.key) as [string, ...string[]];

export const Extraction = z.object({
  is_receipt: z.boolean().describe("true si la imagen o el texto describe un pago, compra, transferencia o factura"),
  kind: z.enum(["transfer", "delivery", "store_receipt", "utility_bill", "rent", "cash_note", "other"]),
  amount: z.number().nullable().describe("Total pagado en dólares, con decimales. Si hay varios montos, el total final cobrado."),
  date: z.string().nullable().describe("Fecha de la operación en formato YYYY-MM-DD"),
  merchant: z.string().nullable().describe("Comercio, empresa o persona a la que se le pagó"),
  description: z.string().describe("Descripción corta en español, máx. 6 palabras, ej. 'Pizza en Uber Eats'"),
  category: z.enum(categoryKeys),
  payer_name: z.string().nullable().describe("Nombre de quien pagó, solo si está escrito en la imagen"),
  recipient_name: z.string().nullable(),
  reference: z.string().nullable().describe("Número de comprobante, referencia u orden, si aparece"),
  suggestion: z
    .enum(["personal", "shared", "pot", "service", "rent", "debt"])
    .describe(
      "personal: gasto de una sola persona; shared: gasto común que se divide; pot: compra de la casa (súper, comida de la casa); service: pago de un servicio básico; rent: pago del arriendo; debt: préstamo entre las personas de la casa",
    ),
  service_name: z.string().nullable().describe("Si es un servicio, el nombre exacto de la lista de servicios configurados"),
  pot_name: z.string().nullable().describe("Si es de una bolsa, el nombre exacto de la lista de bolsas"),
  billing_period: z.string().nullable().describe("Mes que cubre una planilla de servicio, formato YYYY-MM"),
  debt_person: z.string().nullable().describe("Si es préstamo, el nombre de la persona de la casa involucrada"),
  confidence: z.number().describe("0 a 1: qué tan seguro estás del monto y la fecha"),
  notes: z.string().nullable().describe("Algo raro que la persona deba revisar, en español"),
});
export type ExtractionT = z.infer<typeof Extraction>;

export function aiConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function contextText(ctx: AppContext) {
  const [pots, services] = await Promise.all([
    db.query.pots.findMany({ where: eq(schema.pots.householdId, ctx.household.id) }),
    db.query.services.findMany({ where: and(eq(schema.services.householdId, ctx.household.id), eq(schema.services.active, true)) }),
  ]);
  return [
    `Hoy es ${todayISO(ctx.household.timezone)} (zona horaria ${ctx.household.timezone}). La moneda es el dólar estadounidense.`,
    `Quien sube el registro: ${ctx.me.name}. Personas de la casa: ${ctx.members.map((m) => m.name).join(", ")}.`,
    `Bolsas de la casa: ${pots.map((p) => `${p.name} (${p.kind})`).join(", ") || "ninguna"}.`,
    `Servicios configurados: ${services.map((s) => s.name).join(", ") || "ninguno"}.`,
  ].join("\n");
}

const INSTRUCTIONS = `Eres el asistente de una app para llevar las cuentas de una casa compartida en Ecuador.
Extraes datos de capturas de pantalla o fotos: transferencias bancarias (Banco Pichincha, Guayaquil, Produbanco, Pacífico, Bolivariano, Internacional, Deuna, cooperativas), apps de delivery y transporte (Uber, Uber Eats, PedidosYa, Rappi, DiDi, inDrive), facturas o tickets de tiendas y supermercados (Supermaxi, Mi Comisariato, Tía, Akí, Santa María), planillas o pagos de servicios (luz: CNEL, Empresa Eléctrica; agua: EPMAPS, Interagua, ETAPA; internet: CNT, Netlife, Xtrim, Claro, Puntonet; gas).
Reglas:
- Las fechas en Ecuador suelen venir como día/mes/año. Si la fecha no trae año, usa el año de hoy, salvo que quede en el futuro: entonces el año anterior.
- El monto es el TOTAL cobrado (con propina, envío e impuestos). Nunca inventes un monto: si no se ve, usa null.
- Pedidos por apps (Uber Eats, PedidosYa, Rappi): categoría delivery; la descripción menciona qué se pidió o el local. Viajes de Uber/DiDi/inDrive/taxi: transporte.
- payer_name solo si un nombre aparece escrito en la imagen (por ejemplo el titular de la cuenta de origen). Nunca uses el nombre de quien sube la captura.
- En texto libre, «le presté a X» o «X me debe» es suggestion = debt con debt_person = X.
- Si es un pago de servicio, suggestion = service y service_name debe ser uno de los servicios configurados (el más parecido). Usa billing_period si la planilla dice el mes.
- Súper o compras de comida para la casa: suggestion = pot con la bolsa de comida si existe.
- Si no es un comprobante, is_receipt = false y explícalo en notes.
- Responde en español.`;

/** Lee una captura con la IA y guarda el resultado en la fila del archivo. */
export async function analyzeFile(ctx: AppContext, fileId: string): Promise<ExtractionT | null> {
  const file = await db.query.files.findFirst({
    where: and(eq(schema.files.id, fileId), eq(schema.files.householdId, ctx.household.id)),
  });
  if (!file) return null;
  if (file.aiStatus === "done") return file.aiResult as ExtractionT;
  if (!aiConfigured()) {
    await db.update(schema.files).set({ aiStatus: "error", aiError: "Falta configurar la API key de OpenAI." }).where(eq(schema.files.id, file.id));
    return null;
  }
  try {
    const bytes = await downloadReceipt(file.storagePath);
    const dataUrl = `data:${file.mime};base64,${bytes.toString("base64")}`;
    const response = await client().responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: `${await contextText(ctx)}\n\nExtrae los datos de esta imagen.` },
            { type: "input_image", image_url: dataUrl, detail: "auto" },
          ],
        },
      ],
      text: { format: zodTextFormat(Extraction, "comprobante") },
    });
    const result = response.output_parsed;
    if (!result) throw new Error("La IA no devolvió datos");
    await db.update(schema.files).set({ aiStatus: "done", aiResult: result, aiError: null }).where(eq(schema.files.id, file.id));
    return result;
  } catch (e) {
    console.error("analyzeFile", e);
    const message = e instanceof Error ? e.message : "Error de la IA";
    await db.update(schema.files).set({ aiStatus: "error", aiError: message.slice(0, 300) }).where(eq(schema.files.id, file.id));
    return null;
  }
}

/** Interpreta un texto libre como "le presté 2 dólares a Beto para un taxi". */
export async function analyzeText(ctx: AppContext, text: string): Promise<ExtractionT | null> {
  if (!aiConfigured()) return null;
  const response = await client().responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    instructions: INSTRUCTIONS,
    input: [{ role: "user", content: `${await contextText(ctx)}\n\nLa persona escribió: «${text}». Extrae los datos.` }],
    text: { format: zodTextFormat(Extraction, "comprobante") },
  });
  return response.output_parsed ?? null;
}

/** Busca otra captura ya registrada que parezca el mismo pago. */
export async function findDuplicate(ctx: AppContext, fileId: string, x: ExtractionT | null, sha256: string) {
  const sameImage = await db.query.files.findFirst({
    where: and(
      eq(schema.files.householdId, ctx.household.id),
      eq(schema.files.sha256, sha256),
      ne(schema.files.id, fileId),
      eq(schema.files.draftStatus, "used"),
    ),
  });
  if (sameImage) return { reason: "Esta misma imagen ya se subió antes.", fileId: sameImage.id };
  if (!x?.amount || !x.date) return null;
  const cents = Math.round(x.amount * 100);
  const similar = await db.query.events.findFirst({
    where: and(
      eq(schema.events.householdId, ctx.household.id),
      eq(schema.events.amountCents, cents),
      eq(schema.events.occurredOn, x.date),
      sql`${schema.events.fileId} is not null`,
      or(isNull(schema.events.privateTo), eq(schema.events.privateTo, ctx.me.id)),
    ),
  });
  if (similar) return { reason: `Ya hay un registro de ${x.amount.toFixed(2)} del mismo día: «${similar.title}».`, eventId: similar.id };
  return null;
}
