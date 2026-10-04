import { requireContext } from "@/lib/auth";
import { Group, Row, Screen } from "@/components/ui";

export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  await requireContext();
  return (
    <Screen title="Ajustes" back="/yo">
      <Group footer="Los cambios cuentan desde ahora. El historial no se modifica.">
        <Row href="/yo/ajustes/casa" icon={<span className="text-[20px]">🏡</span>} title="La casa y las personas" />
        <Row href="/yo/ajustes/bolsas" icon={<span className="text-[20px]">👛</span>} title="Bolsas" />
        <Row href="/yo/ajustes/arriendo" icon={<span className="text-[20px]">🏠</span>} title="Arriendo" />
        <Row href="/yo/ajustes/aportes" icon={<span className="text-[20px]">💵</span>} title="Aportes" />
        <Row href="/yo/ajustes/servicios" icon={<span className="text-[20px]">💡</span>} title="Servicios" />
      </Group>
    </Screen>
  );
}
