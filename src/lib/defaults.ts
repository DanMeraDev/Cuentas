// Sugerencias genéricas para el asistente. No incluyen montos ni nombres de personas.
export const SUGGESTED_POTS = [
  { key: "rent", name: "Arriendo", emoji: "🏠", kind: "rent" },
  { key: "food", name: "Comida", emoji: "🛒", kind: "food" },
  { key: "services", name: "Servicios", emoji: "💡", kind: "services" },
] as const;

export const SUGGESTED_SERVICES = [
  { name: "Luz", emoji: "💡", accumulable: false },
  { name: "Agua", emoji: "🚰", accumulable: false },
  { name: "Gas", emoji: "🔥", accumulable: false },
  { name: "Internet", emoji: "📶", accumulable: true },
] as const;

export const CATEGORIES = [
  { key: "comida", label: "Comida", emoji: "🍽️" },
  { key: "super", label: "Súper", emoji: "🛒" },
  { key: "delivery", label: "Delivery", emoji: "🛵" },
  { key: "transporte", label: "Transporte", emoji: "🚕" },
  { key: "servicios", label: "Servicios", emoji: "💡" },
  { key: "arriendo", label: "Arriendo", emoji: "🏠" },
  { key: "casa", label: "Casa", emoji: "🧽" },
  { key: "salud", label: "Salud", emoji: "💊" },
  { key: "ocio", label: "Ocio", emoji: "🎮" },
  { key: "ropa", label: "Ropa", emoji: "👕" },
  { key: "educacion", label: "Estudios", emoji: "📚" },
  { key: "prestamo", label: "Préstamo", emoji: "🤝" },
  { key: "ingreso", label: "Ingreso", emoji: "💵" },
  { key: "ajuste", label: "Ajuste de saldo", emoji: "🏦" },
  { key: "otros", label: "Otros", emoji: "📦" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function categoryOf(key: string | null | undefined) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}
