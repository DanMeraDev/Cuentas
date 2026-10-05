CREATE TABLE "external_debt_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_debt_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_debt_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "external_debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"person_name" text NOT NULL,
	"direction" text NOT NULL,
	"mode" text NOT NULL,
	"pot_id" uuid,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"occurred_on" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_debts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "external_payment_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_payment_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "external_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"external_debt_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"pot_id" uuid,
	"amount_cents" integer NOT NULL,
	"occurred_on" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "external_debt_shares" ADD CONSTRAINT "external_debt_shares_external_debt_id_external_debts_id_fk" FOREIGN KEY ("external_debt_id") REFERENCES "public"."external_debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_debt_shares" ADD CONSTRAINT "external_debt_shares_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_debts" ADD CONSTRAINT "external_debts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_debts" ADD CONSTRAINT "external_debts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_debts" ADD CONSTRAINT "external_debts_pot_id_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."pots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_payment_shares" ADD CONSTRAINT "external_payment_shares_payment_id_external_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."external_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_payment_shares" ADD CONSTRAINT "external_payment_shares_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_payments" ADD CONSTRAINT "external_payments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_payments" ADD CONSTRAINT "external_payments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_payments" ADD CONSTRAINT "external_payments_external_debt_id_external_debts_id_fk" FOREIGN KEY ("external_debt_id") REFERENCES "public"."external_debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_payments" ADD CONSTRAINT "external_payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_payments" ADD CONSTRAINT "external_payments_pot_id_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."pots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_debts_household_idx" ON "external_debts" USING btree ("household_id");