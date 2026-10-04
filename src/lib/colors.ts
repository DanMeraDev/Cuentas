export const MEMBER_COLORS = ["cobalt", "tangerine", "jade", "berry", "ochre", "slate"] as const;
export type MemberColor = (typeof MEMBER_COLORS)[number];

export function colorVars(color: string) {
  const c = (MEMBER_COLORS as readonly string[]).includes(color) ? color : "slate";
  return { fg: `var(--m-${c})`, soft: `var(--m-${c}-soft)` };
}
