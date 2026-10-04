export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 pt-safe pb-safe">
      <div className="mb-8">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-8 rounded-full" style={{ background: "var(--m-cobalt)" }} />
          <span className="h-2.5 w-8 rounded-full" style={{ background: "var(--m-tangerine)" }} />
        </div>
        <p className="mt-4 text-[34px] leading-[1.05] font-800 tracking-[-0.03em]">Cuentas de la casa</p>
        <p className="mt-2 text-[15px] text-ink-2">Quién pagó qué, quién tiene la plata y quién le debe a quién.</p>
      </div>
      {children}
    </main>
  );
}
