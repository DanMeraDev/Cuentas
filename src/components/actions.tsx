"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ActionForm, Field, Segmented, SubmitButton, inputClass } from "./forms";
import { markContribution, undoEvent } from "@/lib/actions/money";
import type { ActionResult } from "@/lib/actions/result";
import { formatCents } from "@/lib/money";
import { cx } from "@/lib/cx";

type M = { id: string; name: string };

/** Botón que ejecuta una acción con campos ocultos. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "primary",
  className,
  pendingText,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  pendingText?: string;
}) {
  return (
    <ActionForm action={action} className={className}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} className="w-full" pendingText={pendingText}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}

export function UndoButton({ eventId, next, label = "Borrar este registro" }: { eventId: string; next?: string; label?: string }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="w-full py-3 text-[15px] font-600 text-bad">
        {label}
      </button>
    );
  }
  return (
    <div className="rounded-2xl bg-sheet p-4">
      <p className="mb-3 text-[15px]">Se borra este registro y todo lo que movió (saldos, deudas). ¿Seguro?</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConfirm(false)} className="h-12 rounded-full bg-paper font-700">
          Cancelar
        </button>
        <ActionButton action={undoEvent} fields={{ eventId, ...(next ? { next } : {}) }} variant="danger" pendingText="Borrando…">
          Sí, borrar
        </ActionButton>
      </div>
    </div>
  );
}

export type DueItem = {
  contributionId: string;
  name: string;
  source: string;
  period: string;
  label: string;
  overdue: boolean;
  totalCents: number;
  defaultReceiverId: string | null;
  lines: { id: string; label: string; amountCents: number }[];
};

export function ContributionCheck({ item, members, meId, today }: { item: DueItem; members: M[]; meId: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [editAmounts, setEditAmounts] = useState(false);
  return (
    <div className="px-4 py-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left" aria-expanded={open}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper text-[19px]">💵</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] leading-tight font-600">{item.name}</span>
          <span className={cx("mt-0.5 block text-[13px]", item.overdue ? "text-warn" : "text-ink-2")}>
            {item.overdue ? "Pendiente · " : ""}
            {item.label}
          </span>
        </span>
        <span className="amount text-[16px]">{formatCents(item.totalCents)}</span>
        <ChevronDown size={18} className={cx("text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ActionForm action={markContribution} className="mt-3 space-y-3">
          <input type="hidden" name="contributionId" value={item.contributionId} />
          <input type="hidden" name="period" value={item.period} />
          <Field label={`¿Quién recibió la plata de ${item.source}?`}>
            <Segmented
              name="receivedBy"
              defaultValue={item.defaultReceiverId ?? meId}
              options={members.map((m) => ({ value: m.id, label: m.id === meId ? "Yo" : m.name }))}
            />
          </Field>
          <Field label="Fecha">
            <input type="date" name="occurredOn" defaultValue={today} max={today} className={inputClass} />
          </Field>
          {item.lines.length > 0 && (
            <div className="rounded-xl bg-paper px-3.5 py-2.5">
              <button type="button" onClick={() => setEditAmounts((e) => !e)} className="flex w-full items-center justify-between text-[14px] text-ink-2">
                <span>{item.lines.map((l) => `${l.label} ${formatCents(l.amountCents)}`).join(" · ")}</span>
                <span className="ml-2 shrink-0 font-600 text-ink">{editAmounts ? "Listo" : "Cambiar"}</span>
              </button>
              {editAmounts && (
                <div className="mt-2 space-y-2">
                  {item.lines.map((l) => (
                    <label key={l.id} className="flex items-center gap-2">
                      <span className="flex-1 text-[14px]">{l.label}</span>
                      <span className="text-ink-3">$</span>
                      <input
                        name={`line_${l.id}`}
                        inputMode="decimal"
                        defaultValue={(l.amountCents / 100).toFixed(2)}
                        className="amount w-24 rounded-lg bg-sheet px-2 py-2 text-right outline-none"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <SubmitButton name="status" value="received" pendingText="Guardando…">
              Recibido
            </SubmitButton>
            <SubmitButton name="status" value="skipped" variant="secondary" pendingText="…">
              No llegó
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
