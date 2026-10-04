"use server";

import { actionContext } from "@/lib/auth";
import { analyzeText, aiConfigured } from "@/lib/ai";
import { loadHouse } from "@/lib/queries";
import { registerProps } from "@/lib/register";

export async function interpretText(text: string) {
  const ctx = await actionContext();
  const clean = text.trim().slice(0, 500);
  if (!clean) return { error: "Escribe qué pasó." };
  if (!aiConfigured()) return { error: "La IA no está configurada todavía. Llena el formulario a mano." };
  try {
    const x = await analyzeText(ctx, clean);
    const house = await loadHouse(ctx);
    return { props: registerProps(ctx, house, x, null) };
  } catch (e) {
    console.error(e);
    return { error: "No se pudo interpretar. Llena el formulario a mano." };
  }
}
