import { requireContext } from "@/lib/auth";
import { HouseholdForm } from "@/components/config/HouseholdForm";
import { Screen } from "@/components/ui";

export default async function AjustesCasaPage() {
  const ctx = await requireContext();
  return (
    <Screen title="La casa" back="/yo/ajustes">
      <HouseholdForm
        defaults={{
          name: ctx.household.name,
          myName: ctx.me.name,
          myColor: ctx.me.color,
          otherName: ctx.others[0]?.name ?? "",
          otherColor: ctx.others[0]?.color ?? "tangerine",
        }}
      />
    </Screen>
  );
}
