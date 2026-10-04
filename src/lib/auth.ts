import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { createSupabaseServerClient } from "./supabase/server";
import type { Household, Member } from "./db/schema";

export type AppContext = {
  userId: string;
  email: string | null;
  me: Member;
  household: Household;
  members: Member[];
  /** el resto de miembros (normalmente uno) */
  others: Member[];
};

export const getUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return { id: data.claims.sub as string, email: (data.claims.email as string) ?? null };
});

/** Contexto sin redirecciones: null si falta sesión o casa. */
export const loadContext = cache(async (): Promise<AppContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const me = await db.query.members.findFirst({
    where: eq(schema.members.userId, user.id),
  });
  if (!me) return null;
  const household = await db.query.households.findFirst({
    where: eq(schema.households.id, me.householdId),
  });
  if (!household) return null;
  const members = await db.query.members.findMany({
    where: eq(schema.members.householdId, household.id),
    orderBy: asc(schema.members.createdAt),
  });
  return {
    userId: user.id,
    email: user.email,
    me,
    household,
    members,
    others: members.filter((m) => m.id !== me.id),
  };
});

/** Para páginas de la app: exige sesión y casa configurada. */
export async function requireContext(opts: { allowSetup?: boolean } = {}): Promise<AppContext> {
  const user = await getUser();
  if (!user) redirect("/login");
  const ctx = await loadContext();
  if (!ctx) redirect("/bienvenida");
  if (!ctx.household.setupDone && !opts.allowSetup) redirect("/bienvenida");
  return ctx;
}

/** Para Server Actions: lanza error en vez de redirigir. */
export async function actionContext(): Promise<AppContext> {
  const ctx = await loadContext();
  if (!ctx) throw new Error("No autorizado");
  return ctx;
}
