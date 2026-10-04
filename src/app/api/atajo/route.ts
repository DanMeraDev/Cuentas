import { NextResponse } from "next/server";
import { contextFromRequest } from "@/lib/tokens";
import { storeReceipt } from "@/lib/storage";
import { analyzeFile } from "@/lib/ai";
import { formatCents } from "@/lib/money";
import { formatDay } from "@/lib/periods";
import { appOrigin } from "@/lib/origin";

export const maxDuration = 60;

/**
 * El atajo del iPhone manda aquí la captura (cuerpo = la imagen, o multipart
 * con el campo "file"). Responde con lo que leyó la IA para mostrar un menú.
 */
export async function POST(request: Request) {
  const ctx = await contextFromRequest(request);
  if (!ctx) return NextResponse.json({ error: "Token inválido. Genera uno nuevo en la app." }, { status: 401 });

  let bytes: Buffer;
  let mime = request.headers.get("content-type")?.split(";")[0] ?? "";
  if (mime.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
    bytes = Buffer.from(await file.arrayBuffer());
    mime = file.type || "image/jpeg";
  } else {
    bytes = Buffer.from(await request.arrayBuffer());
    if (!mime.startsWith("image/")) mime = "image/jpeg";
  }
  if (!bytes.length) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });

  try {
    const { file, duplicateOf } = await storeReceipt({
      householdId: ctx.household.id,
      memberId: ctx.me.id,
      bytes,
      mime,
      draft: true,
    });
    const x = await analyzeFile(ctx, file.id);
    const parts = [
      x?.description ?? "Captura",
      x?.amount != null ? formatCents(Math.round(x.amount * 100)) : "sin monto",
      x?.date ? formatDay(x.date) : null,
    ].filter(Boolean);
    return NextResponse.json({
      id: file.id,
      resumen: `${parts.join(" · ")}${duplicateOf ? " (¡ojo, parece repetida!)" : ""}`,
      monto: x?.amount ?? null,
      sugerencia: x?.suggestion ?? null,
      listo: x?.amount != null,
      url: `${await appOrigin()}/nuevo/${file.id}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo procesar" }, { status: 400 });
  }
}
