// Evaluador de expresiones simples para la calculadora (sin eval).
// Soporta + − × ÷, decimales con punto o coma, paréntesis y porcentaje (10%).

type Tok = { t: "num"; v: number } | { t: "op"; v: string } | { t: "(" } | { t: ")" };

function tokenize(src: string): Tok[] {
  const s = src.replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw new Error("número inválido");
      out.push({ t: "num", v: n });
      i = j;
    } else if (ch === "%") {
      const last = out[out.length - 1];
      if (last?.t !== "num") throw new Error("% inválido");
      last.v = last.v / 100;
      i++;
    } else if ("+-*/".includes(ch)) {
      const prev = out[out.length - 1];
      // signo unario: al inicio o después de un operador o "("
      if (ch === "-" && (!prev || prev.t === "op" || prev.t === "(")) {
        out.push({ t: "num", v: 0 });
      }
      out.push({ t: "op", v: ch });
      i++;
    } else if (ch === "(") {
      out.push({ t: "(" });
      i++;
    } else if (ch === ")") {
      out.push({ t: ")" });
      i++;
    } else {
      throw new Error("carácter inválido");
    }
  }
  return out;
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

/** Devuelve el resultado o null si la expresión está incompleta o es inválida. */
export function evaluate(src: string): number | null {
  try {
    const tokens = tokenize(src);
    if (!tokens.length) return null;
    const out: number[] = [];
    const ops: string[] = [];
    const apply = () => {
      const op = ops.pop()!;
      const b = out.pop();
      const a = out.pop();
      if (a === undefined || b === undefined) throw new Error("incompleta");
      out.push(op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b);
    };
    for (const tk of tokens) {
      if (tk.t === "num") out.push(tk.v);
      else if (tk.t === "(") ops.push("(");
      else if (tk.t === ")") {
        while (ops.length && ops[ops.length - 1] !== "(") apply();
        if (ops.pop() !== "(") throw new Error("paréntesis");
      } else {
        while (ops.length && ops[ops.length - 1] !== "(" && PREC[ops[ops.length - 1]] >= PREC[tk.v]) apply();
        ops.push(tk.v);
      }
    }
    while (ops.length) {
      if (ops[ops.length - 1] === "(") throw new Error("paréntesis");
      apply();
    }
    if (out.length !== 1 || !Number.isFinite(out[0])) return null;
    return Math.round(out[0] * 100) / 100;
  } catch {
    return null;
  }
}
