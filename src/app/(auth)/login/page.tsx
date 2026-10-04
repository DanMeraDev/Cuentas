import Link from "next/link";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/forms";
import { signIn } from "@/lib/actions/auth";

export const metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <>
      <ActionForm action={signIn} className="space-y-4">
        <Field label="Correo">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Contraseña">
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <SubmitButton className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-[14px] text-ink-2">
        ¿Es la primera vez?{" "}
        <Link href="/registro" className="font-700 text-ink underline underline-offset-4">
          Crear la casa
        </Link>
      </p>
    </>
  );
}
