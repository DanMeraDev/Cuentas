import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { loadContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { canSeeFile, signedUrl } from "@/lib/storage";

// Redirige a un enlace firmado y temporal de la imagen (el bucket es privado).
export async function GET(_: Request, { params }: RouteContext<"/api/archivos/[id]">) {
  const ctx = await loadContext();
  if (!ctx) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const file = await db.query.files.findFirst({ where: eq(schema.files.id, id) });
  if (!file || !canSeeFile(file, ctx.household.id, ctx.me.id)) return new NextResponse(null, { status: 404 });
  const url = await signedUrl(file.storagePath);
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, max-age=300" } });
}
