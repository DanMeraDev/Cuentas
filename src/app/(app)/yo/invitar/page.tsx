import { requireContext } from "@/lib/auth";
import { ShareButton } from "@/components/ShareButton";
import { Group, Notice, Row, Screen } from "@/components/ui";
import { regenerateInvite } from "@/lib/actions/config";
import { appOrigin } from "@/lib/origin";

export const metadata = { title: "Invitar" };

export default async function InvitarPage() {
  const ctx = await requireContext();
  const url = `${await appOrigin()}/unirse/${ctx.household.inviteCode}`;
  const pending = ctx.others.filter((m) => !m.userId);
  return (
    <Screen title="Invitar" back="/yo">
      {pending.length ? (
        <>
          <Notice>
            Falta que {pending.map((m) => m.name).join(" y ")} cree su cuenta. Mándale este enlace:
          </Notice>
          <p className="mt-3 break-all rounded-2xl bg-sheet px-4 py-3 text-[14px]">{url}</p>
          <div className="mt-3">
            <ShareButton url={url} text={`Únete a «${ctx.household.name}» para llevar las cuentas de la casa`} />
          </div>
        </>
      ) : (
        <Notice tone="good">Todos ya tienen cuenta.</Notice>
      )}
      <Group title="Personas de la casa">
        {ctx.members.map((m) => (
          <Row key={m.id} title={m.name} subtitle={m.userId ? "Con cuenta" : "Sin cuenta todavía"} />
        ))}
      </Group>
      <form action={regenerateInvite} className="mt-6">
        <button className="w-full py-3 text-[14px] font-600 text-ink-2">Generar un enlace nuevo (el anterior deja de servir)</button>
      </form>
    </Screen>
  );
}
