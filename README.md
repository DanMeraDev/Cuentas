# Cuentas de la casa

App web (instalable en iPhone) para llevar las cuentas de una casa compartida: gastos con captura y lectura por IA, arriendo, bolsas (fondos) con quién tiene la plata, servicios, aportes de la familia y deudas entre quienes viven ahí.

El plan funcional completo está en [`PLAN.md`](PLAN.md).

## Desarrollo local

Requisitos: Node 22, pnpm y Docker.

```bash
pnpm install
pnpm exec supabase start      # Supabase local en los puertos 553xx
pnpm db:up                    # aplica las migraciones
pnpm dev                      # http://localhost:3005
pnpm test                     # pruebas de la lógica de saldos
```

`.env.local` ya trae las claves del Supabase local. Solo falta pegar `OPENAI_API_KEY`.

## Subirla a internet (gratis)

### 1. Supabase (base de datos, login y capturas)

1. Crea un proyecto en [supabase.com](https://supabase.com) (región: São Paulo, la más cercana a Ecuador).
2. Copia estos datos:
   - **Project Settings → Data API**: la URL del proyecto.
   - **Project Settings → API Keys**: la *publishable key* y la *secret key*.
   - **Connect → Transaction pooler**: la cadena de conexión (puerto 6543), con tu contraseña de la base.
3. Aplica las migraciones (crean las tablas y el bucket privado `receipts`):

   ```bash
   pnpm exec supabase db push --db-url "postgresql://postgres.xxxx:CONTRASEÑA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
   ```

   Usa el puerto **5432** (session pooler) para las migraciones; la app usa el 6543.

### 2. Vercel (la app)

1. Sube el proyecto a GitHub e impórtalo en [vercel.com](https://vercel.com), o usa `pnpm dlx vercel` desde esta carpeta.
2. En **Settings → Environment Variables** agrega las variables de `.env.example`:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | Transaction pooler (puerto 6543) |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SECRET_KEY` | secret key |
   | `OPENAI_API_KEY` | tu clave de OpenAI |
   | `OPENAI_MODEL` | `gpt-4.1-mini` (o el modelo con visión que prefieras) |

3. Despliega. La primera persona entra a `/registro`, crea la casa y le manda el enlace de invitación a la otra.

### 3. En el iPhone

Abrir la app en Safari → Compartir → **Agregar a inicio**. Para el atajo «Registrar gasto» desde el menú Compartir, sigue los pasos en la app: **Yo → Instalar en el iPhone y atajo**.

## Cómo está armada

- **Next.js 16** (App Router, Server Actions, `proxy.ts` para la sesión).
- **Supabase**: Auth (correo y contraseña), Postgres y Storage. Las tablas tienen RLS activado sin políticas: solo el servidor accede, con conexión directa (Drizzle + postgres.js).
- **OpenAI** (Responses API con salida estructurada) lee las capturas: `src/lib/ai.ts`.
- **Modelo de datos** (`src/lib/db/schema.ts`): cada acción es un `event`. Los asientos cuelgan de él con `ON DELETE CASCADE`, así que deshacer una acción es borrar su evento.
  - `pot_movements`: plata de cada bolsa y quién la tiene (custodio).
  - `member_ledger`: deudas entre miembros.
  - `personal_entries`: finanzas privadas de cada uno.
- **Lógica pura con pruebas** en `src/lib/domain/`: saldos, entregas entre custodios, estado del arriendo y servicios pendientes.
