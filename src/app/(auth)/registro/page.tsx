import Link from "next/link";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/forms";
import { signUpFirst } from "@/lib/actions/auth";

export const metadata = { title: "Crear la casa" };

export default function RegistroPage() {
  return (
    <>
      <p className="mb-5 text-[15px] text-ink-2">
        Crea tu cuenta y después configuras la casa. A la otra persona le llega un enlace de invitación.
      </p>
      <ActionForm action={signUpFirst} className="space-y-4">
        <Field label="Correo">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres.">
          <input name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
        </Field>
        <SubmitButton className="w-full" pendingText="Creando…">Crear cuenta</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-[14px] text-ink-2">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-700 text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </>
  );
}
