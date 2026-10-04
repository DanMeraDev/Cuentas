@AGENTS.md

# Proyecto: Cuentas de la casa

- UI y textos en español (Ecuador, USD). Montos siempre en centavos (`integer`).
- Cada acción de dinero = un `event` + asientos (`pot_movements`, `member_ledger`, `personal_entries`) en una transacción (`src/lib/ledger.ts`). Deshacer = borrar el evento (cascade).
- Lógica de saldos pura y con pruebas en `src/lib/domain/` (`pnpm test`). Si cambias reglas de dinero, agrega un caso ahí.
- Privacidad: `events.private_to` / `files.private_to` = solo su dueño. Filtrar siempre con `isNull(privateTo) OR privateTo = me`.
- Nada de nombres o montos fijos en el código: todo sale de la configuración de la casa.
- Dev: `pnpm exec supabase start` (puertos 553xx) y `pnpm dev` (puerto 3005). El puerto 3000 lo usa otro proyecto.
- Migraciones: editar `src/lib/db/schema.ts` → `pnpm db:generate` → `pnpm db:up`.
