export type ActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  at?: number;
} | null;

export const ok = (message?: string): ActionResult => ({ ok: true, message, at: Date.now() });
export const fail = (error: string): ActionResult => ({ error, at: Date.now() });

/** Convierte errores lanzados en mensajes legibles para el formulario. */
export async function attempt(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (e) {
    // redirect() y notFound() lanzan errores especiales que hay que dejar pasar
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error(e);
    return fail(e instanceof UserError ? e.message : "Algo salió mal. Intenta de nuevo.");
  }
}

/** Error con un mensaje que sí se le puede mostrar a la persona. */
export class UserError extends Error {}
