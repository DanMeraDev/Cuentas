import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { loadContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { canSeeFile, signedUrl } from "@/lib/storage";

// Redirige a un enlace firmado y temporal de la imagen (el bucket es privado).
// Con ?descargar=1 el navegador lo descarga con un nombre legible.
export async function GET(request: Request, { params }: RouteContext<"/api/archivos/[id]">) {
  const ctx = await loadContext();
  if (!ctx) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const file = await db.query.files.findFirst({ where: eq(schema.files.id, id) });
  if (!file || !canSeeFile(file, ctx.household.id, ctx.me.id)) return new NextResponse(null, { status: 404 });
  let downloadAs: string | undefined;
  if (new URL(request.url).searchParams.get("descargar")) {
    const event = await db.query.events.findFirst({ where: eq(schema.events.fileId, file.id) });
    const ext = file.storagePath.split(".").pop() ?? "jpg";
    const base = (event ? `${event.occurredOn} ${event.title}` : `comprobante ${file.createdAt.toISOString().slice(0, 10)}`)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);
    downloadAs = `${base || "comprobante"}.${ext}`;
  }
  const url = await signedUrl(file.storagePath, 600, downloadAs);
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, max-age=300" } });
}
