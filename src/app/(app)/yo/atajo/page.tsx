import { eq } from "drizzle-orm";
import { requireContext } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { TokenBox } from "@/components/TokenBox";
import { Group, Screen } from "@/components/ui";
import { appOrigin } from "@/lib/origin";

export const metadata = { title: "iPhone" };

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3 p-4">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-snug">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-800 text-sheet">{i + 1}</span>
          <span className="pt-0.5">{it}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function AtajoPage() {
  const ctx = await requireContext();
  const origin = await appOrigin();
  const token = await db.query.apiTokens.findFirst({ where: eq(schema.apiTokens.memberId, ctx.me.id) });
  const code = "rounded bg-paper px-1.5 py-0.5 text-[13px]";
  return (
    <Screen title="En el iPhone" back="/yo">
      <Group title="Instalar la app">
        <Steps
          items={[
            <>Abre esta página en <strong>Safari</strong>.</>,
            <>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha).</>,
            <>Elige <strong>Agregar a inicio</strong> y confirma.</>,
            <>Ábrela desde el ícono: se ve en pantalla completa, como una app.</>,
          ]}
        />
      </Group>

      <Group title="1. Tu clave para el atajo" footer="Cada persona usa su propia clave: así la app sabe quién registró cada captura.">
        <div className="p-4">
          <TokenBox hasToken={!!token} />
        </div>
      </Group>

      <Group title="2. Crear el atajo «Registrar gasto»" footer="Se hace una sola vez. Después, desde cualquier captura: Compartir → Registrar gasto.">
        <Steps
          items={[
            <>Abre la app <strong>Atajos</strong> y crea uno nuevo llamado <strong>Registrar gasto</strong>.</>,
            <>En los detalles del atajo activa <strong>Mostrar en hoja para compartir</strong> y deja solo <strong>Imágenes</strong>.</>,
            <>Agrega <strong>Convertir imagen</strong> a <strong>JPEG</strong> y luego <strong>Redimensionar imagen</strong> a ancho <span className={code}>1600</span>.</>,
            <>
              Agrega <strong>Obtener contenido de URL</strong>: URL <span className={`${code} break-all`}>{origin}/api/atajo</span>, método{" "}
              <strong>POST</strong>, encabezado <span className={code}>Authorization</span> = <span className={code}>Bearer TU_CLAVE</span>, cuerpo{" "}
              <strong>Archivo</strong> con la imagen redimensionada.
            </>,
            <>Agrega <strong>Obtener valor de diccionario</strong> con la clave <span className={code}>resumen</span>.</>,
            <>
              Agrega <strong>Elegir del menú</strong> con ese resumen como mensaje y las opciones: <strong>Mío</strong>, <strong>Compartido</strong>,{" "}
              <strong>De la comida</strong> y <strong>Revisar en la app</strong>.
            </>,
            <>
              En cada opción agrega <strong>Obtener contenido de URL</strong>: URL <span className={`${code} break-all`}>{origin}/api/atajo/confirmar</span>,
              método <strong>POST</strong>, el mismo encabezado, cuerpo <strong>JSON</strong> con <span className={code}>id</span> = el valor{" "}
              <span className={code}>id</span> de la primera respuesta y <span className={code}>opcion</span> ={" "}
              <span className={code}>personal</span>, <span className={code}>compartido</span>, <span className={code}>comida</span> o{" "}
              <span className={code}>despues</span>.
            </>,
            <>Al final agrega <strong>Mostrar notificación</strong> con el valor <span className={code}>mensaje</span> de la respuesta.</>,
          ]}
        />
      </Group>
    </Screen>
  );
}
