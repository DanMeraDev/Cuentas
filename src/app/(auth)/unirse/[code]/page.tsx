import { and, eq, isNull } from "drizzle-orm";
import { ActionForm, Field, Segmented, SubmitButton, inputClass } from "@/components/forms";
import { joinHousehold } from "@/lib/actions/auth";
import { db, schema } from "@/lib/db";

export const metadata = { title: "Unirse a la casa" };

export default async function UnirsePage({ params }: PageProps<"/unirse/[code]">) {
  const { code } = await params;
  const household = await db.query.households.findFirst({
    where: eq(schema.households.inviteCode, code),
  });
  if (!household) {
    return <p className="text-[15px] text-ink-2">Este enlace de invitación no es válido. Pide uno nuevo.</p>;
  }
  const open = await db.query.members.findMany({
    where: and(eq(schema.members.householdId, household.id), isNull(schema.members.userId)),
  });
  if (open.length === 0) {
    return <p className="text-[15px] text-ink-2">Todos los lugares de «{household.name}» ya tienen cuenta. Inicia sesión.</p>;
  }
  return (
    <>
      <p className="mb-5 text-[15px] text-ink-2">
        Te invitaron a <strong className="text-ink">{household.name}</strong>. Crea tu cuenta para entrar.
      </p>
      <ActionForm action={joinHousehold} className="space-y-4">
        <input type="hidden" name="code" value={code} />
        {open.length > 1 ? (
          <Field label="¿Quién eres?">
            <Segmented name="memberId" options={open.map((m) => ({ value: m.id, label: m.name }))} />
          </Field>
        ) : (
          <>
            <input type="hidden" name="memberId" value={open[0].id} />
            <p className="text-[17px] font-700">Hola, {open[0].name}</p>
          </>
        )}
        <Field label="Correo">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres.">
          <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
        </Field>
        <SubmitButton className="w-full" pendingText="Creando…">Crear cuenta y entrar</SubmitButton>
      </ActionForm>
    </>
  );
}
