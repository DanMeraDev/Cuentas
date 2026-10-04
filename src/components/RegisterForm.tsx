"use client";

import { useState } from "react";
import { ActionForm, AmountInput, Field, Segmented, SubmitButton, inputClass } from "./forms";
import { createDebt, createExpense, payService, rentPay } from "@/lib/actions/money";
import { CATEGORIES } from "@/lib/defaults";
import { formatCents, parseAmountToCents, splitEvenly } from "@/lib/money";
import { cx } from "@/lib/cx";

type M = { id: string; name: string };
type P = { id: string; name: string; emoji: string; kind: string; totalCents: number };
type S = { id: string; name: string; emoji: string; choices: { value: string; label: string }[]; preselected: string[] };

export type RegisterDefaults = {
  type: "expense" | "service" | "rent" | "debt";
  scope: "personal" | "shared" | "pot";
  amount: string;
  date: string;
  description: string;
  merchant: string;
  category: string;
  potId: string | null;
  serviceId: string | null;
  debtOtherId: string | null;
};

export function RegisterForm({
  fileId,
  defaults,
  members,
  meId,
  pots,
  services,
  rent,
  today,
}: {
  fileId: string | null;
  defaults: RegisterDefaults;
  members: M[];
  meId: string;
  pots: P[];
  services: S[];
  rent: { available: boolean; paid: boolean; payerId: string | null; totalCents: number };
  today: string;
}) {
  const [type, setType] = useState(defaults.type);
  const [scope, setScope] = useState(defaults.scope);
  const [split, setSplit] = useState<"equal" | "custom">("equal");
  const [amount, setAmount] = useState(defaults.amount);
  const [serviceId, setServiceId] = useState(defaults.serviceId ?? services[0]?.id ?? "");
  const others = members.filter((m) => m.id !== meId);
  const service = services.find((s) => s.id === serviceId);
  const amountCents = parseAmountToCents(amount) ?? 0;
  const even = splitEvenly(amountCents, members.length);

  const typeOptions = [
    { value: "expense", label: "Gasto" },
    { value: "service", label: "Servicio" },
    ...(rent.available && !rent.paid ? [{ value: "rent", label: "Arriendo" }] : []),
    { value: "debt", label: "Préstamo" },
  ];

  const common = (
    <>
      {fileId && <input type="hidden" name="fileId" value={fileId} />}
      <Field label="Monto">
        <div onChange={(e) => setAmount((e.target as HTMLInputElement).value)}>
          <AmountInput name="amount" defaultValue={amount} required large />
        </div>
      </Field>
      <Field label="Fecha">
        <input type="date" name="occurredOn" defaultValue={defaults.date || today} max={today} className={inputClass} />
      </Field>
    </>
  );

  const payer = (label = "¿Quién pagó?", def = meId) => (
    <Field label={label}>
      <Segmented name="paidBy" defaultValue={def} options={members.map((m) => ({ value: m.id, label: m.id === meId ? "Yo" : m.name }))} />
    </Field>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-sheet p-4">
        <p className="mb-2 text-[14px] font-600 text-ink-2">¿Qué es?</p>
        <Segmented
          name="_type"
          defaultValue={type}
          columns={typeOptions.length}
          onChange={(v) => setType(v as RegisterDefaults["type"])}
          options={typeOptions}
        />
      </div>

      {type === "expense" && (
        <ActionForm action={createExpense} className="space-y-4">
          <div className="space-y-4 rounded-2xl bg-sheet p-4">
            <Field label="¿De quién es el gasto?">
              <Segmented
                name="scope"
                defaultValue={scope}
                onChange={(v) => setScope(v as RegisterDefaults["scope"])}
                options={[
                  { value: "personal", label: "Mío", hint: "Solo lo ves tú" },
                  { value: "shared", label: "Compartido", hint: "Se divide" },
                  { value: "pot", label: "De una bolsa", hint: "Ej. comida" },
                ]}
              />
            </Field>
            {common}
            <Field label="Descripción">
              <input name="description" defaultValue={defaults.description} required className={inputClass} placeholder="Ej. Pizza para los dos" />
            </Field>
            <input type="hidden" name="merchant" value={defaults.merchant} />
            <Field label="Categoría">
              <select name="category" defaultValue={defaults.category} className={inputClass}>
                {CATEGORIES.filter((c) => c.key !== "ingreso").map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {scope === "pot" && (
            <div className="space-y-4 rounded-2xl bg-sheet p-4">
              <Field label="¿De qué bolsa sale?">
                <select name="potId" defaultValue={defaults.potId ?? pots.find((p) => p.kind === "food")?.id ?? pots[0]?.id} className={inputClass}>
                  {pots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name} (tiene {formatCents(p.totalCents)})
                    </option>
                  ))}
                </select>
              </Field>
              {payer("¿Quién lo pagó?")}
              <p className="text-[13px] text-ink-3">
                Si lo pagaste con tu plata y otra persona tiene la plata de la bolsa, la app te lo anota para que te la
                devuelva.
              </p>
            </div>
          )}

          {scope === "shared" && (
            <div className="space-y-4 rounded-2xl bg-sheet p-4">
              {payer()}
              <Field label="¿Cómo se divide?">
                <Segmented
                  name="split"
                  defaultValue={split}
                  onChange={(v) => setSplit(v as "equal" | "custom")}
                  options={[
                    { value: "equal", label: "Mitad y mitad", hint: amountCents ? `${formatCents(even[0])} c/u` : undefined },
                    { value: "custom", label: "Otro reparto" },
                  ]}
                />
              </Field>
              {split === "custom" && (
                <div className="space-y-2">
                  {members.map((m, i) => (
                    <label key={m.id} className="flex items-center gap-3">
                      <span className="flex-1 text-[15px] font-600">{m.id === meId ? "Yo" : m.name}</span>
                      <span className="text-ink-3">$</span>
                      <input
                        name={`share_${m.id}`}
                        inputMode="decimal"
                        defaultValue={amountCents ? (even[i] / 100).toFixed(2) : ""}
                        className="amount w-28 rounded-xl bg-paper px-3 py-3 text-right outline-none"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <SubmitButton className="w-full">Guardar gasto</SubmitButton>
        </ActionForm>
      )}

      {type === "service" && (
        <ActionForm action={payService} className="space-y-4">
          <input type="hidden" name="next" value="/" />
          <div className="space-y-4 rounded-2xl bg-sheet p-4">
            <Field label="Servicio">
              <div className="flex flex-wrap gap-2">
                {services.map((s) => (
                  <label key={s.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="serviceId"
                      value={s.id}
                      checked={serviceId === s.id}
                      onChange={() => setServiceId(s.id)}
                      className="peer sr-only"
                    />
                    <span className="block rounded-full bg-paper px-3.5 py-2 text-[15px] font-600 peer-checked:bg-ink peer-checked:text-sheet">
                      {s.emoji} {s.name}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
            {common}
            {service && (
              <fieldset key={service.id}>
                <legend className="mb-1.5 text-[14px] font-600 text-ink-2">¿Qué meses cubre?</legend>
                <div className="flex flex-wrap gap-2">
                  {service.choices.map((c) => (
                    <label key={c.value} className="cursor-pointer">
                      <input type="checkbox" name="periods" value={c.value} defaultChecked={service.preselected.includes(c.value)} className="peer sr-only" />
                      <span className="block rounded-full bg-paper px-3.5 py-2 text-[14px] font-600 peer-checked:bg-ink peer-checked:text-sheet">
                        {c.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {payer()}
          </div>
          <SubmitButton className="w-full">Guardar pago del servicio</SubmitButton>
        </ActionForm>
      )}

      {type === "rent" && (
        <ActionForm action={rentPay} className="space-y-4">
          <input type="hidden" name="next" value="/casa/arriendo" />
          <div className="space-y-4 rounded-2xl bg-sheet p-4">
            {common}
            {payer("¿Quién le pagó al dueño?", rent.payerId ?? meId)}
          </div>
          <SubmitButton className="w-full">Registrar pago del arriendo</SubmitButton>
        </ActionForm>
      )}

      {type === "debt" && (
        <ActionForm action={createDebt} className="space-y-4">
          <div className="space-y-4 rounded-2xl bg-sheet p-4">
            <Field label="¿Qué pasó?">
              <Segmented
                name="direction"
                defaultValue="they_owe"
                options={[
                  { value: "they_owe", label: "Yo le presté" },
                  { value: "i_owe", label: "Me prestaron" },
                ]}
              />
            </Field>
            {others.length > 1 ? (
              <Field label="¿A quién?">
                <Segmented name="otherId" defaultValue={defaults.debtOtherId ?? others[0]?.id} options={others.map((m) => ({ value: m.id, label: m.name }))} />
              </Field>
            ) : (
              <input type="hidden" name="otherId" value={others[0]?.id ?? ""} />
            )}
            {common}
            <Field label="¿Para qué fue?">
              <input name="description" defaultValue={defaults.description} required className={inputClass} placeholder="Ej. Taxi" />
            </Field>
          </div>
          <SubmitButton className="w-full">Guardar préstamo</SubmitButton>
        </ActionForm>
      )}
      <p className={cx("px-1 text-[13px] text-ink-3", !fileId && "hidden")}>La captura queda guardada como prueba.</p>
    </div>
  );
}
