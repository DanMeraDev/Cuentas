import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Las clases font-600/font-700/... son pesos (definidos en globals.css)
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-weight": [{ font: ["500", "600", "700", "800"] }] } },
});

export const cx = (...args: ClassValue[]) => twMerge(clsx(args));
