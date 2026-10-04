import { requireContext } from "@/lib/auth";
import { loadHouse } from "@/lib/queries";
import { registerProps } from "@/lib/register";
import { ManualRegister } from "@/components/ManualRegister";
import { Screen } from "@/components/ui";

export const metadata = { title: "Registrar a mano" };

export default async function ManualPage() {
  const ctx = await requireContext();
  const house = await loadHouse(ctx);
  return (
    <Screen title="A mano" back="/nuevo">
      <ManualRegister initial={registerProps(ctx, house, null, null)} />
    </Screen>
  );
}
