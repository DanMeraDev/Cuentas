import { requireContext } from "@/lib/auth";
import { pendingDrafts } from "@/lib/queries";
import { UploadStart } from "@/components/UploadStart";
import { Group, Row, Screen } from "@/components/ui";

export const metadata = { title: "Registrar" };

export default async function NuevoPage() {
  const ctx = await requireContext();
  const drafts = await pendingDrafts(ctx);
  return (
    <Screen title="Registrar">
      <UploadStart />
      {drafts.length > 0 && (
        <Group>
          <Row
            href="/nuevo/pendientes"
            icon={<span className="text-[22px]">📥</span>}
            title={`${drafts.length} ${drafts.length === 1 ? "captura" : "capturas"} del atajo por confirmar`}
          />
        </Group>
      )}
      <Group title="Sin captura">
        <Row href="/nuevo/manual" icon={<span className="text-[22px]">✍️</span>} title="Escribir a mano" subtitle="Ej. «le presté $2 para un taxi»" />
      </Group>
      <Group title="Atajos">
        <Row href="/casa/aportes" icon={<span className="text-[22px]">💵</span>} title="Llegó un aporte" subtitle="Marcar plata recibida" />
        <Row href="/casa/arriendo" icon={<span className="text-[22px]">🏠</span>} title="Arriendo" subtitle="Ya tengo mi parte, entregar o pagar" />
        <Row href="/casa/servicios" icon={<span className="text-[22px]">💡</span>} title="Pagué un servicio" />
        <Row href="/balance" icon={<span className="text-[22px]">🤝</span>} title="Deudas y préstamos" />
      </Group>
    </Screen>
  );
}
