"use client";

import { useState } from "react";
import { MEMBER_COLORS } from "@/lib/colors";
import { cx } from "@/lib/cx";

const LABELS: Record<string, string> = {
  cobalt: "Azul",
  tangerine: "Naranja",
  jade: "Verde",
  berry: "Fucsia",
  ochre: "Mostaza",
  slate: "Gris",
};

export function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex gap-2.5" role="radiogroup">
      {MEMBER_COLORS.map((c) => (
        <label key={c} className="cursor-pointer" title={LABELS[c]}>
          <input
            type="radio"
            name={name}
            value={c}
            checked={value === c}
            onChange={() => setValue(c)}
            className="peer sr-only"
            aria-label={LABELS[c]}
          />
          <span
            className={cx(
              "block size-9 rounded-full ring-offset-2 ring-offset-[var(--sheet)] transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ink)]",
              value === c && "ring-[3px] ring-[var(--ink)]",
            )}
            style={{ background: `var(--m-${c})` }}
          />
        </label>
      ))}
    </div>
  );
}
