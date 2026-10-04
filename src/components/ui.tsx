import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { colorVars } from "@/lib/colors";
import { formatCents } from "@/lib/money";

export function Screen({
  title,
  back,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  back?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mx-auto w-full max-w-lg px-4 pt-safe", className)}>
      {(title || back || action) && (
        <header className="pt-4 pb-3">
          <div className="flex h-9 items-center justify-between">
            {back ? (
              <Link
                href={back}
                className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 text-[15px] font-medium text-ink-2 active:bg-press"
              >
                <ChevronLeft size={20} strokeWidth={2.25} />
                Atrás
              </Link>
            ) : (
              <span />
            )}
            {action}
          </div>
          {title && (
            <h1 className="mt-1 text-[30px] leading-[1.1] font-800 tracking-[-0.025em]">
              {title}
            </h1>
          )}
        </header>
      )}
      <div className="pb-32">{children}</div>
    </div>
  );
}

export function Group({
  title,
  footer,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mt-6", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-baseline justify-between px-1">
          {title && <h2 className="text-[17px] font-700 tracking-[-0.01em]">{title}</h2>}
          {action}
        </div>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-sheet">{children}</div>
      {footer && <p className="mt-2 px-1 text-[13px] leading-snug text-ink-3">{footer}</p>}
    </section>
  );
}

export function Row({
  href,
  icon,
  title,
  subtitle,
  value,
  valueTone,
  chevron,
  className,
  children,
}: {
  href?: string;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  valueTone?: "good" | "bad" | "warn" | "muted";
  chevron?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const inner = (
    <>
      {icon && <div className="flex size-9 shrink-0 items-center justify-center">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[16px] leading-tight font-600">{title}</div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-ink-2">{subtitle}</div>}
        {children}
      </div>
      {value !== undefined && (
        <div
          className={cx(
            "amount shrink-0 text-right text-[16px]",
            valueTone === "good" && "text-good",
            valueTone === "bad" && "text-bad",
            valueTone === "warn" && "text-warn",
            valueTone === "muted" && "text-ink-3",
          )}
        >
          {value}
        </div>
      )}
      {(chevron ?? !!href) && <ChevronRight size={18} className="shrink-0 text-ink-3" />}
    </>
  );
  const cls = cx("flex items-center gap-3 px-4 py-3 min-h-[56px]", className);
  if (href)
    return (
      <Link href={href} className={cx(cls, "active:bg-press")}>
        {inner}
      </Link>
    );
  return <div className={cls}>{inner}</div>;
}

export function Emoji({ children, soft }: { children: ReactNode; soft?: string }) {
  return (
    <span
      className="flex size-9 items-center justify-center rounded-xl text-[19px]"
      style={{ background: soft ?? "var(--press)" }}
    >
      {children}
    </span>
  );
}

export function MemberDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: colorVars(color).fg }}
    />
  );
}

export function MemberBadge({ name, color }: { name: string; color: string }) {
  const c = colorVars(color);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-600"
      style={{ background: c.soft, color: c.fg }}
    >
      <MemberDot color={color} size={7} />
      {name}
    </span>
  );
}

export function MemberAvatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const c = colorVars(color);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-800"
      style={{ width: size, height: size, background: c.soft, color: c.fg, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={cx("amount", className)}>{formatCents(cents)}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-[16px] font-600">{title}</p>
      {children && <div className="mt-1 text-[14px] text-ink-2">{children}</div>}
    </div>
  );
}

export function Pill({
  tone = "muted",
  children,
}: {
  tone?: "good" | "warn" | "bad" | "muted";
  children: ReactNode;
}) {
  const styles = {
    good: "text-good bg-[color-mix(in_srgb,var(--good)_14%,transparent)]",
    warn: "text-warn bg-[color-mix(in_srgb,var(--warn)_14%,transparent)]",
    bad: "text-bad bg-[color-mix(in_srgb,var(--bad)_14%,transparent)]",
    muted: "text-ink-2 bg-press",
  }[tone];
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-700", styles)}>
      {children}
    </span>
  );
}

export function Notice({
  tone = "muted",
  children,
}: {
  tone?: "good" | "warn" | "bad" | "muted";
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl px-4 py-3 text-[14px] leading-snug",
        tone === "warn" && "bg-[color-mix(in_srgb,var(--warn)_12%,var(--sheet))] text-ink",
        tone === "bad" && "bg-[color-mix(in_srgb,var(--bad)_12%,var(--sheet))] text-ink",
        tone === "good" && "bg-[color-mix(in_srgb,var(--good)_12%,var(--sheet))] text-ink",
        tone === "muted" && "bg-sheet text-ink-2",
      )}
    >
      {children}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant), className)}>
      {children}
    </Link>
  );
}

export function buttonClass(variant: "primary" | "secondary" | "ghost" | "danger" = "primary") {
  return cx(
    "inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[16px] font-700 transition-transform active:scale-[0.98] disabled:opacity-50",
    variant === "primary" && "bg-ink text-sheet",
    variant === "secondary" && "bg-sheet text-ink ring-1 ring-line",
    variant === "ghost" && "text-ink-2 active:bg-press",
    variant === "danger" && "bg-sheet text-bad ring-1 ring-line",
  );
}
