import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { supabaseAdmin } from "./supabase/admin";

const BUCKET = "receipts";
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_BYTES = 8 * 1024 * 1024;

export async function storeReceipt(opts: {
  householdId: string;
  memberId: string;
  bytes: Buffer;
  mime: string;
  draft?: boolean;
}) {
  if (!ALLOWED.includes(opts.mime)) throw new Error("Formato no permitido. Sube una imagen.");
  if (opts.bytes.length > MAX_BYTES) throw new Error("La imagen pesa demasiado (máx. 8 MB).");
  const sha256 = createHash("sha256").update(opts.bytes).digest("hex");
  const duplicate = await db.query.files.findFirst({
    where: and(eq(schema.files.householdId, opts.householdId), eq(schema.files.sha256, sha256)),
  });
  const ext = opts.mime.split("/")[1].replace("jpeg", "jpg");
  const path = `${opts.householdId}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, opts.bytes, {
    contentType: opts.mime,
    upsert: false,
  });
  if (error) throw error;
  const [file] = await db
    .insert(schema.files)
    .values({
      householdId: opts.householdId,
      uploadedBy: opts.memberId,
      storagePath: path,
      mime: opts.mime,
      sizeBytes: opts.bytes.length,
      sha256,
      draftStatus: opts.draft ? "pending" : "none",
    })
    .returning();
  return { file, duplicateOf: duplicate ?? null };
}

export async function signedUrl(storagePath: string, seconds = 600, downloadAs?: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, seconds, downloadAs ? { download: downloadAs } : undefined);
  return data?.signedUrl ?? null;
}

export async function downloadReceipt(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw error ?? new Error("No se pudo leer la imagen");
  return Buffer.from(await data.arrayBuffer());
}

/** ¿Puede este miembro ver este archivo? */
export function canSeeFile(file: { householdId: string; privateTo: string | null }, householdId: string, memberId: string) {
  return file.householdId === householdId && (!file.privateTo || file.privateTo === memberId);
}
