import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireContext, type AppContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { analyzeFile, findDuplicate, type ExtractionT } from "@/lib/ai";
import { loadHouse } from "@/lib/queries";
import { registerProps } from "@/lib/register";
import { RegisterForm } from "@/components/RegisterForm";
import { Notice, Screen } from "@/components/ui";
import { canSeeFile } from "@/lib/storage";
import { formatCents } from "@/lib/money";
import Link from "next/link";

export const metadata = { title: "Confirmar registro" };

export default async function ConfirmarPage({ params }: PageProps<"/nuevo/[id]">) {
  const { id } = await params;
  const ctx = await requireContext();
  const file = await db.query.files.findFirst({
    where: and(eq(schema.files.id, id), eq(schema.files.householdId, ctx.household.id)),
  });
  if (!file || !canSeeFile(file, ctx.household.id, ctx.me.id)) notFound();
  return (
    <Screen title="Confirmar" back="/nuevo">
      <a href={`/api/archivos/${file.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl bg-sheet">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/archivos/${file.id}`} alt="Captura subida" className="max-h-72 w-full object-contain" />
      </a>
      {file.draftStatus === "used" ? (
        <div className="mt-4">
          <Notice tone="good">Esta captura ya está registrada.</Notice>
        </div>
      ) : (
        <Suspense fallback={<Reading />}>
          <Analyzed ctx={ctx} fileId={file.id} sha256={file.sha256} />
        </Suspense>
      )}
    </Screen>
  );
}

function Reading() {
  return (
    <div className="mt-4 rounded-2xl bg-sheet p-5" role="status">
      <p className="text-[17px] font-700">Leyendo la captura…</p>
      <p className="mt-1 text-[14px] text-ink-2">La IA está sacando el monto, la fecha y el comercio.</p>
      <div className="mt-4 space-y-2" aria-hidden>
        {[70, 45, 85].map((w) => (
          <div key={w} className="h-4 animate-pulse rounded-full bg-press" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

async function Analyzed({ ctx, fileId, sha256 }: { ctx: AppContext; fileId: string; sha256: string }) {
  const [x, house] = await Promise.all([analyzeFile(ctx, fileId), loadHouse(ctx)]);
  const file = await db.query.files.findFirst({ where: eq(schema.files.id, fileId) });
  const dup = await findDuplicate(ctx, fileId, x, sha256);
  const props = registerProps(ctx, house, x, fileId);
  return (
    <div className="mt-4 space-y-3">
      <Summary x={x} error={file?.aiError ?? null} />
      {dup && (
        <Notice tone="warn">
          ¿Repetido? {dup.reason}{" "}
          {"eventId" in dup && dup.eventId && (
            <Link href={`/movimientos/${dup.eventId}`} className="font-700 underline underline-offset-4">
              Ver registro
            </Link>
          )}
        </Notice>
      )}
      <RegisterForm {...props} />
    </div>
  );
}

function Summary({ x, error }: { x: ExtractionT | null; error: string | null }) {
  if (!x) {
    return (
      <Notice tone="warn">
        No se pudo leer la captura{error ? ` (${error})` : ""}. Completa los datos a mano.
      </Notice>
    );
  }
  if (!x.is_receipt) {
    return <Notice tone="warn">Esto no parece un comprobante. {x.notes ?? ""}</Notice>;
  }
  return (
    <Notice tone={x.confidence < 0.6 ? "warn" : "good"}>
      La IA leyó <strong className="amount">{x.amount != null ? formatCents(Math.round(x.amount * 100)) : "sin monto"}</strong>
      {x.merchant ? ` en ${x.merchant}` : ""}
      {x.payer_name ? `, pagado por ${x.payer_name}` : ""}. Revisa y confirma.
      {x.notes ? ` ${x.notes}` : ""}
    </Notice>
  );
}
