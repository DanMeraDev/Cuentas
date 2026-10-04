import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "./db";
import type { AppContext } from "./auth";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueToken(memberId: string): Promise<string> {
  const token = `cc_${randomBytes(24).toString("base64url")}`;
  // un token por persona: el nuevo reemplaza al anterior
  await db.delete(schema.apiTokens).where(eq(schema.apiTokens.memberId, memberId));
  await db.insert(schema.apiTokens).values({ memberId, tokenHash: hashToken(token) });
  return token;
}

/** Contexto de la app a partir del token del atajo (Authorization: Bearer ...). */
export async function contextFromRequest(request: Request): Promise<AppContext | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const row = await db.query.apiTokens.findFirst({ where: eq(schema.apiTokens.tokenHash, hashToken(token)) });
  if (!row) return null;
  const me = await db.query.members.findFirst({ where: eq(schema.members.id, row.memberId) });
  if (!me?.userId) return null;
  const household = await db.query.households.findFirst({ where: eq(schema.households.id, me.householdId) });
  if (!household) return null;
  const members = await db.query.members.findMany({
    where: eq(schema.members.householdId, household.id),
    orderBy: asc(schema.members.createdAt),
  });
  await db.update(schema.apiTokens).set({ lastUsedAt: new Date() }).where(eq(schema.apiTokens.id, row.id));
  return { userId: me.userId, email: null, me, household, members, others: members.filter((m) => m.id !== me.id) };
}
