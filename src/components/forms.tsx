"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/lib/cx";
import { buttonClass } from "./ui";
import type { ActionResult } from "@/lib/actions/result";

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess && state?.ok ? String(state.at) : undefined}
    >
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--bad)_12%,var(--sheet))] px-4 py-3 text-[14px] text-bad">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--good)_12%,var(--sheet))] px-4 py-3 text-[14px] text-good">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
  pendingText = "Guardando…",
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cx(buttonClass(variant), className)}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export const inputClass =
  "block w-full rounded-xl bg-paper px-3.5 py-3 text-[16px] text-ink placeholder:text-ink-3 outline-none ring-1 ring-transparent focus:ring-[var(--m-cobalt)]";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[14px] font-600 text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[13px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function AmountInput({
  name,
  defaultValue,
  placeholder = "0.00",
  required,
  autoFocus,
  large,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  large?: boolean;
}) {
  return (
    <div className={cx("flex items-center rounded-xl bg-paper px-3.5 focus-within:ring-1 focus-within:ring-[var(--m-cobalt)]", large ? "py-2" : "py-3")}>
      <span className={cx("mr-1 font-700 text-ink-3", large ? "text-[28px]" : "text-[16px]")}>$</span>
      <input
        name={name}
        inputMode="decimal"
        autoComplete="off"
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={cx("amount w-full bg-transparent outline-none placeholder:text-ink-3", large ? "text-[34px]" : "text-[16px]")}
      />
    </div>
  );
}

export type SegmentOption = { value: string; label: ReactNode; hint?: ReactNode };

/** Grupo de opciones tipo "píldoras" (radio). */
export function Segmented({
  name,
  options,
  defaultValue,
  onChange,
  columns,
}: {
  name: string;
  options: SegmentOption[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  columns?: number;
}) {
  const [value, setValue] = useState(defaultValue ?? options[0]?.value);
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns ?? Math.min(options.length, 3)}, minmax(0, 1fr))` }}
      role="radiogroup"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            className={cx(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl px-2 py-2.5 text-center text-[14px] font-600 transition-colors",
              active ? "bg-ink text-sheet" : "bg-paper text-ink active:bg-press",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={active}
              onChange={() => {
                setValue(o.value);
                onChange?.(o.value);
              }}
              className="sr-only"
            />
            {o.label}
            {o.hint && <span className={cx("mt-0.5 text-[12px] font-500", active ? "text-sheet/70" : "text-ink-3")}>{o.hint}</span>}
          </label>
        );
      })}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl bg-sheet p-4", className)}>{children}</div>;
}
