"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator as CalcIcon, Delete, X } from "lucide-react";
import { evaluate } from "@/lib/calc";
import { formatCents } from "@/lib/money";
import { cx } from "@/lib/cx";

const KEYS = ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", ".", "0", "⌫", "="];

/** Hoja con una calculadora. Si recibe onUse, muestra el botón para pasar el resultado a un campo. */
export function CalculatorSheet({
  initial = "",
  onClose,
  onUse,
}: {
  initial?: string;
  onClose: () => void;
  onUse?: (value: string) => void;
}) {
  const [expr, setExpr] = useState(initial);
  const result = evaluate(expr);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (/^[0-9.,()+\-*/]$/.test(e.key)) setExpr((x) => x + e.key.replace("*", "×").replace("/", "÷").replace("-", "−"));
      else if (e.key === "Backspace") setExpr((x) => x.slice(0, -1));
      else if (e.key === "Enter" && result !== null) setExpr(String(result));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, result]);

  function press(k: string) {
    if (k === "C") setExpr("");
    else if (k === "⌫") setExpr((x) => x.slice(0, -1));
    else if (k === "=") {
      if (result !== null) setExpr(String(result));
    } else setExpr((x) => x + k);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Calculadora">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Cerrar calculadora" />
      <div className="animate-sheet relative w-full max-w-lg rounded-t-[28px] bg-sheet px-4 pt-3 pb-safe shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-700 text-ink-2">Calculadora</span>
          <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full active:bg-press" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="mt-1 rounded-2xl bg-paper px-4 py-3 text-right">
          <p className="min-h-[24px] truncate text-[18px] text-ink-2" aria-live="polite">
            {expr || "0"}
          </p>
          <p className="amount text-[36px] leading-tight">{result !== null ? formatCents(Math.round(result * 100)) : "—"}</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              aria-label={k === "⌫" ? "Borrar" : k === "C" ? "Limpiar" : k}
              className={cx(
                "flex h-14 items-center justify-center rounded-2xl text-[22px] font-700 active:scale-95 transition-transform",
                "÷×−+=".includes(k) ? "bg-ink text-sheet" : k === "C" || k === "⌫" || k === "(" || k === ")" ? "bg-press text-ink" : "bg-paper text-ink",
              )}
            >
              {k === "⌫" ? <Delete size={22} /> : k}
            </button>
          ))}
        </div>
        {onUse && (
          <button
            type="button"
            disabled={result === null || result < 0}
            onClick={() => {
              if (result === null) return;
              onUse(result.toFixed(2));
              onClose();
            }}
            className="mt-3 mb-2 flex h-12 w-full items-center justify-center rounded-full bg-ink text-[16px] font-700 text-sheet disabled:opacity-40"
          >
            Usar {result !== null && result >= 0 ? formatCents(Math.round(result * 100)) : ""}
          </button>
        )}
        {!onUse && <div className="h-2" />}
      </div>
    </div>,
    document.body,
  );
}

/** Botón discreto para abrir la calculadora sin pasar el resultado a ningún campo. */
export function CalculatorButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx("flex size-10 items-center justify-center rounded-full active:bg-press", className)}
        aria-label="Abrir calculadora"
      >
        <CalcIcon size={21} />
      </button>
      {open && <CalculatorSheet onClose={() => setOpen(false)} />}
    </>
  );
}
