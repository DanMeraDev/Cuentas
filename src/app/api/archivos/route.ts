import { NextResponse } from "next/server";
import { loadContext } from "@/lib/auth";
import { storeReceipt } from "@/lib/storage";

export async function POST(request: Request) {
  const ctx = await loadContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  try {
    const { file: row, duplicateOf } = await storeReceipt({
      householdId: ctx.household.id,
      memberId: ctx.me.id,
      bytes: Buffer.from(await file.arrayBuffer()),
      mime: file.type || "image/jpeg",
    });
    return NextResponse.json({ id: row.id, duplicateOf: duplicateOf?.id ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al subir" }, { status: 400 });
  }
}
