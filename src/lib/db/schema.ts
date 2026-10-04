import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Montos siempre en centavos (integer) para evitar errores de redondeo.
// Todas las tablas tienen RLS activado sin políticas: la API pública de
// Supabase no puede leerlas; solo el servidor (conexión directa) accede.

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Configuración de la casa
// ---------------------------------------------------------------------------

export const households = pgTable("households", {
  id: id(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("America/Guayaquil"),
  inviteCode: text("invite_code").notNull().unique(),
  setupStep: integer("setup_step").notNull().default(1),
  setupDone: boolean("setup_done").notNull().default(false),
  createdAt: createdAt(),
}).enableRLS();

export const members = pgTable(
  "members",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // null hasta que la persona se registre con el enlace de invitación
    userId: uuid("user_id").unique(),
    name: text("name").notNull(),
    color: text("color").notNull().default("indigo"),
    createdAt: createdAt(),
  },
  (t) => [index("members_household_idx").on(t.householdId)],
).enableRLS();

export const pots = pgTable(
  "pots",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("💰"),
    // rent | food | services | other (solo orienta a la IA y a la UI)
    kind: text("kind").notNull().default("other"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("pots_household_idx").on(t.householdId)],
).enableRLS();

export const contributions = pgTable(
  "contributions",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: text("source").notNull(),
    // weekly | monthly
    frequency: text("frequency").notNull(),
    defaultReceiverId: uuid("default_receiver_id").references(() => members.id, {
      onDelete: "set null",
    }),
    // primer período que cuenta, ej. 2026-10 o 2026-W40
    startPeriod: text("start_period").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("contributions_household_idx").on(t.householdId)],
).enableRLS();

export const contributionLines = pgTable("contribution_lines", {
  id: id(),
  contributionId: uuid("contribution_id")
    .notNull()
    .references(() => contributions.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  // pot | member
  dest: text("dest").notNull(),
  potId: uuid("pot_id").references(() => pots.id, { onDelete: "restrict" }),
  memberId: uuid("member_id").references(() => members.id, {
    onDelete: "restrict",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
}).enableRLS();

export const rentConfig = pgTable("rent_config", {
  householdId: uuid("household_id")
    .primaryKey()
    .references(() => households.id, { onDelete: "cascade" }),
  totalCents: integer("total_cents").notNull(),
  potId: uuid("pot_id")
    .notNull()
    .references(() => pots.id, { onDelete: "restrict" }),
  payerId: uuid("payer_id").references(() => members.id, {
    onDelete: "set null",
  }),
  dueDay: integer("due_day").notNull().default(1),
  startPeriod: text("start_period").notNull(),
  active: boolean("active").notNull().default(true),
}).enableRLS();

export const rentShares = pgTable(
  "rent_shares",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.memberId] })],
).enableRLS();

export const services = pgTable(
  "services",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🧾"),
    potId: uuid("pot_id")
      .notNull()
      .references(() => pots.id, { onDelete: "restrict" }),
    // true = se puede dejar un mes sin pagar y pagar varios juntos (internet)
    accumulable: boolean("accumulable").notNull().default(false),
    startPeriod: text("start_period").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("services_household_idx").on(t.householdId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Archivos (capturas y fotos de facturas)
// ---------------------------------------------------------------------------

export const files = pgTable(
  "files",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    // pending | done | error
    aiStatus: text("ai_status").notNull().default("pending"),
    aiResult: jsonb("ai_result"),
    aiError: text("ai_error"),
    // none: subido desde la app | pending: llegó por el atajo y falta confirmar
    // used: ya está vinculado a un registro | discarded
    draftStatus: text("draft_status").notNull().default("none"),
    // si está vinculado a un gasto personal, solo su dueño lo puede ver
    privateTo: uuid("private_to").references(() => members.id, {
      onDelete: "cascade",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("files_household_idx").on(t.householdId),
    index("files_sha_idx").on(t.householdId, t.sha256),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Eventos: cada acción del usuario es un evento. Los asientos contables y
// los registros de dominio cuelgan del evento con ON DELETE CASCADE, así que
// deshacer una acción = borrar su evento.
// ---------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
    amountCents: integer("amount_cents").notNull().default(0),
    title: text("title").notNull(),
    detail: text("detail"),
    category: text("category"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    // gastos personales: solo los ve su dueño
    privateTo: uuid("private_to").references(() => members.id, {
      onDelete: "cascade",
    }),
    data: jsonb("data").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_household_date_idx").on(t.householdId, t.occurredOn),
  ],
).enableRLS();

const eventRef = () =>
  uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" });

// Plata de cada bolsa y quién la tiene (custodio). amount con signo.
export const potMovements = pgTable(
  "pot_movements",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    potId: uuid("pot_id")
      .notNull()
      .references(() => pots.id, { onDelete: "restrict" }),
    holderId: uuid("holder_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    kind: text("kind").notNull(),
    occurredOn: date("occurred_on").notNull(),
  },
  (t) => [index("pot_movements_household_idx").on(t.householdId, t.potId)],
).enableRLS();

export const debts = pgTable(
  "debts",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    debtorId: uuid("debtor_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    creditorId: uuid("creditor_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    occurredOn: date("occurred_on").notNull(),
  },
  (t) => [index("debts_household_idx").on(t.householdId)],
).enableRLS();

// Deudas entre miembros: "debtor le debe amount a creditor".
// Un pago se guarda al revés (el que pagó queda como acreedor).
export const memberLedger = pgTable(
  "member_ledger",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    debtorId: uuid("debtor_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    creditorId: uuid("creditor_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    // debt | debt_payment | shared_expense | contribution_share | settlement
    kind: text("kind").notNull(),
    debtId: uuid("debt_id").references(() => debts.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
  },
  (t) => [index("member_ledger_household_idx").on(t.householdId)],
).enableRLS();

// Finanzas personales de cada miembro (privadas). amount con signo:
// positivo = ingreso, negativo = gasto.
export const personalEntries = pgTable(
  "personal_entries",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    occurredOn: date("occurred_on").notNull(),
  },
  (t) => [index("personal_entries_member_idx").on(t.memberId, t.occurredOn)],
).enableRLS();

// ---------------------------------------------------------------------------
// Registros de dominio (permiten saber qué está pagado en cada período)
// ---------------------------------------------------------------------------

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    // personal | shared | pot
    scope: text("scope").notNull(),
    potId: uuid("pot_id").references(() => pots.id, { onDelete: "restrict" }),
    paidBy: uuid("paid_by")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    merchant: text("merchant"),
    description: text("description").notNull(),
    category: text("category").notNull(),
    occurredOn: date("occurred_on").notNull(),
  },
  (t) => [index("expenses_household_idx").on(t.householdId, t.occurredOn)],
).enableRLS();

export const expenseShares = pgTable(
  "expense_shares",
  {
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.memberId] })],
).enableRLS();

export const contributionReceipts = pgTable(
  "contribution_receipts",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    // received | skipped
    status: text("status").notNull(),
    receivedBy: uuid("received_by").references(() => members.id, {
      onDelete: "restrict",
    }),
    markedBy: uuid("marked_by")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    receivedOn: date("received_on").notNull(),
  },
  // el check queda bloqueado: un solo registro por aporte y período
  (t) => [uniqueIndex("contribution_receipts_unique").on(t.contributionId, t.period)],
).enableRLS();

export const rentMarks = pgTable(
  "rent_marks",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    period: text("period").notNull(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    // set_aside (ya tengo mi parte) | delivered (se la pasé a quien paga)
    kind: text("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    markedOn: date("marked_on").notNull(),
  },
  (t) => [
    uniqueIndex("rent_marks_unique").on(t.householdId, t.period, t.memberId, t.kind),
  ],
).enableRLS();

export const rentPayments = pgTable(
  "rent_payments",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    period: text("period").notNull(),
    paidBy: uuid("paid_by")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    paidOn: date("paid_on").notNull(),
  },
  (t) => [uniqueIndex("rent_payments_unique").on(t.householdId, t.period)],
).enableRLS();

export const servicePayments = pgTable(
  "service_payments",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    eventId: eventRef(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    // meses que cubre este pago, ej. {2026-09, 2026-10}
    periods: text("periods").array().notNull(),
    paidBy: uuid("paid_by")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    paidOn: date("paid_on").notNull(),
  },
  (t) => [index("service_payments_service_idx").on(t.serviceId)],
).enableRLS();

// ---------------------------------------------------------------------------
// Avisos y acceso del atajo de iPhone
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_member_idx").on(t.memberId, t.createdAt)],
).enableRLS();

export const apiTokens = pgTable("api_tokens", {
  id: id(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: createdAt(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
}).enableRLS();

export type Household = typeof households.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Pot = typeof pots.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
export type ContributionLine = typeof contributionLines.$inferSelect;
export type Service = typeof services.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type EventRow = typeof events.$inferSelect;
