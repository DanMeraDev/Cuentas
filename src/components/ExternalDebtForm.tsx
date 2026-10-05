"use client";

import { useState } from "react";
import { ActionForm, AmountInput, Field, Segmented, SubmitButton, inputClass } from "./forms";
import { ReceiptPicker } from "./ReceiptPicker";
import { createExternalDebt } from "@/lib/actions/external";
import { CATEGORIES } from "@/lib/defaults";
import { formatCents, parseAmountToCents, splitEvenly } from "@/lib/money";

type M = { id: string; name: string };
type P = { id: string; name: string; emoji: string; kind: string; totalCents: number };

export function ExternalDebtForm({
  members,
  meId,
  pots,
  today,
  fileId,
}: {
  members: M[];
  meId: string;
  pots: P[];
  today: string;
  fileId: string | null;
}) {
  const [direction, setDirection] = useState<"we_owe" | "they_owe">("we_owe");
  // we_owe: "paid_for" = pagó algo por nosotros; "cash" = nos dio plata
  const [kind, setKind] = useState<"paid_for" | "cash">("paid_for");
  const [cashMode, setCashMode] = useState<"pot" | "personal">("pot");
  const [owner, setOwner] = useState("all");
  const [split, setSplit] = useState<"equal" | "custom">("equal");
  const [amount, setAmount] = useState("");
  const cents = parseAmountToCents(amount) ?? 0;
  const even = splitEvenly(cents, members.length);
  const weOwe = direction === "we_owe";
  const spent = weOwe && kind === "paid_for";
  const mode = spent ? "spent" : cashMode;
  const label = (m: M) => (m.id === meId ? "Yo" : m.name);
  const showSplit = (spent && owner === "all") || (!spent && cashMode === "pot");

  return (
    <ActionForm action={createExternalDebt} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-4 rounded-2xl bg-sheet p-4">
        <Field label="¿Qué pasó?">
          <Segmented
            name="direction"
            defaultValue={direction}
            onChange={(v) => setDirection(v as typeof direction)}
            options={[
              { value: "we_owe", label: "Le debemos" },
              { value: "they_owe", label: "Nos debe" },
            ]}
          />
        </Field>
        <Field label={weOwe ? "¿A quién le deben?" : "¿Quién les debe?"}>
          <input name="personName" required placeholder="Ej. John" className={inputClass} />
        </Field>
        {weOwe && (
          <Field label="¿Cómo fue?">
            <Segmented
              name="_kind"
              defaultValue={kind}
              onChange={(v) => setKind(v as typeof kind)}
              options={[
                { value: "paid_for", label: "Pagó algo por nosotros", hint: "Ej. los ceviches" },
                { value: "cash", label: "Nos dio plata", hint: "Efectivo o transferencia" },
              ]}
            />
          </Field>
        )}
        <Field label="Monto">
          <div onChange={(e) => setAmount((e.target as HTMLInputElement).value)}>
            <AmountInput name="amount" required large />
          </div>
        </Field>
        <Field label={spent ? "¿Qué pagó?" : "¿Para qué?"}>
          <input
            name="description"
            placeholder={spent ? "Ej. Ceviches en Rumiñahui" : weOwe ? "Ej. Para completar el arriendo" : "Ej. Para su pasaje"}
            className={inputClass}
          />
        </Field>
        {spent && (
          <Field label="Categoría">
            <select name="category" defaultValue="comida" className={inputClass}>
              {CATEGORIES.filter((c) => !["ingreso", "prestamo", "ajuste"].includes(c.key)).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Fecha">
          <input type="date" name="occurredOn" defaultValue={today} max={today} className={inputClass} />
        </Field>
      </div>

      <div className="space-y-4 rounded-2xl bg-sheet p-4">
        {spent ? (
          <Field label="¿Quién le debe?">
            <Segmented
              name="owner"
              defaultValue={owner}
              onChange={setOwner}
              columns={Math.min(members.length + 1, 3)}
              options={[
                { value: "all", label: "Entre todos" },
                ...members.map((m) => ({ value: m.id, label: m.id === meId ? "Solo yo" : `Solo ${m.name}` })),
              ]}
            />
          </Field>
        ) : (
          <>
            <Field label={weOwe ? "¿Para quién es la plata?" : "¿De quién es la plata que prestaron?"}>
              <Segmented
                name="_cashMode"
                defaultValue={cashMode}
                onChange={(v) => setCashMode(v as typeof cashMode)}
                options={[
                  { value: "pot", label: "De la casa", hint: "Se divide entre todos" },
                  { value: "personal", label: "De una persona", hint: "Solo de quien la recibió" },
                ]}
              />
            </Field>
            <Field label={weOwe ? "¿Quién recibió la plata?" : "¿Quién entregó la plata?"}>
              <Segmented name="memberId" defaultValue={meId} options={members.map((m) => ({ value: m.id, label: label(m) }))} />
            </Field>
            {cashMode === "pot" && (
              <Field label={weOwe ? "¿A qué bolsa entra?" : "¿De qué bolsa sale?"}>
                <select name="potId" className={inputClass} defaultValue={pots[0]?.id}>
                  {pots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name} (tiene {formatCents(p.totalCents)})
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}
        {showSplit && (
          <>
            <Field label="¿Cuánto le toca a cada uno?">
              <Segmented
                name="split"
                defaultValue={split}
                onChange={(v) => setSplit(v as typeof split)}
                options={[
                  { value: "equal", label: "Mitad y mitad", hint: cents ? `${formatCents(even[0])} c/u` : undefined },
                  { value: "custom", label: "Otro reparto" },
                ]}
              />
            </Field>
            {split === "custom" && (
              <div className="space-y-2">
                {members.map((m, i) => (
                  <label key={m.id} className="flex items-center gap-3">
                    <span className="flex-1 text-[15px] font-600">{label(m)}</span>
                    <span className="text-ink-3">$</span>
                    <input
                      name={`share_${m.id}`}
                      inputMode="decimal"
                      defaultValue={cents ? (even[i] / 100).toFixed(2) : ""}
                      className="amount w-28 rounded-xl bg-paper px-3 py-3 text-right outline-none"
                    />
                  </label>
                ))}
              </div>
            )}
          </>
        )}
        {spent && (
          <p className="text-[13px] leading-snug text-ink-3">
            No entra plata a ninguna bolsa: solo queda anotado cuánto le debe cada uno. Cuando le paguen, cada uno lo
            ve como gasto en esa categoría.
          </p>
        )}
        <ReceiptPicker defaultFileId={fileId} />
      </div>
      <SubmitButton className="w-full">Guardar</SubmitButton>
    </ActionForm>
  );
}
