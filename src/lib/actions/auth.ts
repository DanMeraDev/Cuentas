"use server";

import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { attempt, fail, UserError, type ActionResult } from "./result";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un correo válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function signIn(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("Correo o contraseña incorrectos.");
  redirect("/");
}

async function createAndSignIn(email: string, password: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already")) {
      throw new UserError("Ya existe una cuenta con ese correo. Inicia sesión.");
    }
    throw error ?? new Error("No se pudo crear el usuario");
  }
  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return data.user.id;
}

/** Registro de la primera persona: solo se permite si todavía no hay ninguna casa. */
export async function signUpFirst(_: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await attempt(async () => {
    const parsed = credentials.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const [{ value }] = await db.select({ value: count() }).from(schema.households);
    if (value > 0) {
      return fail("Esta app ya tiene una casa. Pide el enlace de invitación a tu compañero.");
    }
    await createAndSignIn(parsed.data.email, parsed.data.password);
    return null;
  });
  if (result) return result;
  redirect("/bienvenida");
}

/** Registro con el enlace de invitación: ocupa el lugar del miembro elegido. */
export async function joinHousehold(_: ActionResult, form: FormData): Promise<ActionResult> {
  const result = await attempt(async () => {
    const parsed = credentials
      .extend({ code: z.string().min(1), memberId: z.string().uuid("Elige quién eres") })
      .safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { email, password, code, memberId } = parsed.data;

    const household = await db.query.households.findFirst({
      where: eq(schema.households.inviteCode, code),
    });
    if (!household) return fail("El enlace de invitación no es válido.");
    const member = await db.query.members.findFirst({
      where: and(
        eq(schema.members.id, memberId),
        eq(schema.members.householdId, household.id),
        isNull(schema.members.userId),
      ),
    });
    if (!member) return fail("Ese lugar ya fue ocupado por otra cuenta.");

    const userId = await createAndSignIn(email, password);
    await db.update(schema.members).set({ userId }).where(eq(schema.members.id, member.id));
    return null;
  });
  if (result) return result;
  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
