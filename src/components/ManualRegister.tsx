"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { Sparkles } from "lucide-react";
import { RegisterForm } from "./RegisterForm";
import { interpretText } from "@/lib/actions/ai";
import { buttonClass } from "./ui";
import { inputClass } from "./forms";

type Props = ComponentProps<typeof RegisterForm>;

export function ManualRegister({ initial }: { initial: Props }) {
  const [props, setProps] = useState(initial);
  const [version, setVersion] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-sheet p-4">
        <label htmlFor="free" className="mb-1.5 block text-[14px] font-600 text-ink-2">
          Cuéntalo con tus palabras (opcional)
        </label>
        <textarea
          id="free"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Ej. le presté 2 dólares para un taxi"
          className={inputClass + " resize-none"}
        />
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await interpretText(text);
              if ("error" in res && res.error) setError(res.error);
              else if ("props" in res && res.props) {
                setProps(res.props);
                setVersion((v) => v + 1);
              }
            })
          }
          className={buttonClass("secondary") + " mt-3 w-full"}
        >
          <Sparkles size={18} /> {pending ? "Interpretando…" : "Llenar con IA"}
        </button>
        {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
      </div>
      <RegisterForm key={version} {...props} />
    </div>
  );
}
