CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_in" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"scanned_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_in_ticket_id_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE "event_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	CONSTRAINT "event_session_id_event_unique" UNIQUE("id","event_id"),
	CONSTRAINT "event_session_dates_check" CHECK ("event_session"."ends_at" > "event_session"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"image_url" text,
	"venue_id" uuid NOT NULL,
	"organizer_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_status_check" CHECK ("event"."status" in ('draft', 'published', 'cancelled', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "inventory_reservation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '15 minutes' NOT NULL,
	CONSTRAINT "reservation_values_check" CHECK ("inventory_reservation"."quantity" > 0 and "inventory_reservation"."expires_at" = "inventory_reservation"."created_at" + interval '15 minutes'),
	CONSTRAINT "reservation_status_check" CHECK ("inventory_reservation"."status" in ('active', 'converted', 'released'))
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid,
	"stripe_invoice_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'pen' NOT NULL,
	"hosted_invoice_url" text,
	"invoice_pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id"),
	CONSTRAINT "invoice_amount_check" CHECK ("invoice"."amount_cents" >= 0 and "invoice"."currency" = 'pen'),
	CONSTRAINT "invoice_status_check" CHECK ("invoice"."status" in ('draft', 'open', 'paid', 'uncollectible', 'void'))
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	CONSTRAINT "order_item_totals_check" CHECK ("order_item"."quantity" > 0 and "order_item"."unit_price_cents" >= 0 and "order_item"."discount_cents" >= 0 and "order_item"."discount_cents" <= "order_item"."quantity"::bigint * "order_item"."unit_price_cents" and "order_item"."total_cents" = "order_item"."quantity"::bigint * "order_item"."unit_price_cents" - "order_item"."discount_cents")
);
--> statement-breakpoint
CREATE TABLE "order_promotion" (
	"order_id" uuid NOT NULL,
	"promotion_id" uuid NOT NULL,
	"discount_cents" integer NOT NULL,
	CONSTRAINT "order_promotion_order_id_promotion_id_pk" PRIMARY KEY("order_id","promotion_id"),
	CONSTRAINT "order_promotion_discount_check" CHECK ("order_promotion"."discount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"buyer_email" text NOT NULL,
	"buyer_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" text DEFAULT 'pen' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_totals_check" CHECK ("order"."subtotal_cents" >= 0 and "order"."discount_cents" >= 0 and "order"."discount_cents" <= "order"."subtotal_cents" and "order"."total_cents" = "order"."subtotal_cents" - "order"."discount_cents" and "order"."currency" = 'pen'),
	CONSTRAINT "order_status_check" CHECK ("order"."status" in ('pending', 'paid', 'expired', 'cancelled', 'partially_refunded', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"stripe_charge_id" text,
	"idempotency_key" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'pen' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "payment_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "payment_stripe_charge_id_unique" UNIQUE("stripe_charge_id"),
	CONSTRAINT "payment_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payment_amount_check" CHECK ("payment"."amount_cents" >= 0 and "payment"."currency" = 'pen'),
	CONSTRAINT "payment_status_check" CHECK ("payment"."status" in ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"stripe_account_id" uuid NOT NULL,
	"initiated_by_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'pen' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_transfer_id" text,
	"stripe_payout_id" text,
	"idempotency_key" text NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_stripe_transfer_id_unique" UNIQUE("stripe_transfer_id"),
	CONSTRAINT "payout_stripe_payout_id_unique" UNIQUE("stripe_payout_id"),
	CONSTRAINT "payout_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payout_amount_check" CHECK ("payout"."amount_cents" > 0 and "payout"."currency" = 'pen'),
	CONSTRAINT "payout_period_check" CHECK (("payout"."period_start" is null and "payout"."period_end" is null) or ("payout"."period_start" is not null and "payout"."period_end" is not null and "payout"."period_end" > "payout"."period_start")),
	CONSTRAINT "payout_status_check" CHECK ("payout"."status" in ('pending', 'processing', 'transferred', 'paid', 'failed', 'cancelled', 'reversed'))
);
--> statement-breakpoint
CREATE TABLE "promotion_ticket_type" (
	"promotion_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	CONSTRAINT "promotion_ticket_type_promotion_id_ticket_type_id_pk" PRIMARY KEY("promotion_id","ticket_type_id")
);
--> statement-breakpoint
CREATE TABLE "promotion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"max_redemptions" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "promotion_code_unique" UNIQUE("code"),
	CONSTRAINT "promotion_id_event_unique" UNIQUE("id","event_id"),
	CONSTRAINT "promotion_values_check" CHECK (("promotion"."kind" = 'percentage' and "promotion"."value" between 1 and 100) or ("promotion"."kind" = 'fixed' and "promotion"."value" > 0)),
	CONSTRAINT "promotion_dates_check" CHECK ("promotion"."ends_at" > "promotion"."starts_at"),
	CONSTRAINT "promotion_limit_check" CHECK ("promotion"."max_redemptions" is null or "promotion"."max_redemptions" > 0)
);
--> statement-breakpoint
CREATE TABLE "refund_ticket" (
	"refund_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	CONSTRAINT "refund_ticket_refund_id_ticket_id_pk" PRIMARY KEY("refund_id","ticket_id"),
	CONSTRAINT "refund_ticket_amount_check" CHECK ("refund_ticket"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"stripe_refund_id" text,
	"idempotency_key" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_stripe_refund_id_unique" UNIQUE("stripe_refund_id"),
	CONSTRAINT "refund_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "refund_amount_check" CHECK ("refund"."amount_cents" > 0),
	CONSTRAINT "refund_status_check" CHECK ("refund"."status" in ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "role_name_unique" UNIQUE("name"),
	CONSTRAINT "role_name_check" CHECK ("role"."name" in ('super_admin', 'admin', 'organizer', 'customer'))
);
--> statement-breakpoint
CREATE TABLE "stripe_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_account_id" text NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"charges_enabled" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_account_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "stripe_account_stripe_account_id_unique" UNIQUE("stripe_account_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_type_session" (
	"ticket_type_id" uuid NOT NULL,
	"event_session_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	CONSTRAINT "ticket_type_session_ticket_type_id_event_session_id_pk" PRIMARY KEY("ticket_type_id","event_session_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'pen' NOT NULL,
	"capacity" integer NOT NULL,
	"sales_start_at" timestamp with time zone NOT NULL,
	"sales_end_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ticket_type_id_event_unique" UNIQUE("id","event_id"),
	CONSTRAINT "ticket_type_values_check" CHECK ("ticket_type"."price_cents" >= 0 and "ticket_type"."capacity" > 0 and "ticket_type"."currency" = 'pen'),
	CONSTRAINT "ticket_type_dates_check" CHECK ("ticket_type"."sales_end_at" > "ticket_type"."sales_start_at")
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"unit_number" integer NOT NULL,
	"qr_token_hash" text NOT NULL,
	"status" text DEFAULT 'valid' NOT NULL,
	"attendee_name" text,
	"attendee_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_qr_token_hash_unique" UNIQUE("qr_token_hash"),
	CONSTRAINT "ticket_unit_check" CHECK ("ticket"."unit_number" > 0),
	CONSTRAINT "ticket_status_check" CHECK ("ticket"."status" in ('valid', 'used', 'refund_pending', 'refunded', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"name" text NOT NULL,
	"avatar_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"identity_updated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "user_status_check" CHECK ("user"."status" in ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "venue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"country" text DEFAULT 'PE' NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"google_place_id" text,
	CONSTRAINT "venue_coordinates_check" CHECK (("venue"."latitude" is null and "venue"."longitude" is null) or ("venue"."latitude" is not null and "venue"."longitude" is not null and "venue"."latitude" between -90 and 90 and "venue"."longitude" between -180 and 180))
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"object_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"provider_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_provider_check" CHECK ("webhook_event"."provider" in ('stripe', 'clerk')),
	CONSTRAINT "webhook_status_check" CHECK ("webhook_event"."status" in ('pending', 'processing', 'processed', 'failed')),
	CONSTRAINT "webhook_attempts_check" CHECK ("webhook_event"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_scanned_by_id_user_id_fk" FOREIGN KEY ("scanned_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_session" ADD CONSTRAINT "event_session_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organizer_id_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "inventory_reservation_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_ticket_type_id_ticket_type_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_promotion" ADD CONSTRAINT "order_promotion_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_promotion" ADD CONSTRAINT "order_promotion_promotion_id_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_organizer_id_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_stripe_account_id_stripe_account_id_fk" FOREIGN KEY ("stripe_account_id") REFERENCES "public"."stripe_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_initiated_by_id_user_id_fk" FOREIGN KEY ("initiated_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_ticket_type" ADD CONSTRAINT "promotion_ticket_type_promotion_id_event_id_promotion_id_event_id_fk" FOREIGN KEY ("promotion_id","event_id") REFERENCES "public"."promotion"("id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_ticket_type" ADD CONSTRAINT "promotion_ticket_type_ticket_type_id_event_id_ticket_type_id_event_id_fk" FOREIGN KEY ("ticket_type_id","event_id") REFERENCES "public"."ticket_type"("id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion" ADD CONSTRAINT "promotion_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_ticket" ADD CONSTRAINT "refund_ticket_refund_id_refund_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refund"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_ticket" ADD CONSTRAINT "refund_ticket_ticket_id_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_account" ADD CONSTRAINT "stripe_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type_session" ADD CONSTRAINT "ticket_type_session_ticket_type_id_event_id_ticket_type_id_event_id_fk" FOREIGN KEY ("ticket_type_id","event_id") REFERENCES "public"."ticket_type"("id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type_session" ADD CONSTRAINT "ticket_type_session_event_session_id_event_id_event_session_id_event_id_fk" FOREIGN KEY ("event_session_id","event_id") REFERENCES "public"."event_session"("id","event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_type" ADD CONSTRAINT "ticket_type_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "check_in_event_idx" ON "check_in" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "check_in_scanner_idx" ON "check_in" USING btree ("scanned_by_id");--> statement-breakpoint
CREATE INDEX "event_session_event_start_idx" ON "event_session" USING btree ("event_id","starts_at");--> statement-breakpoint
CREATE INDEX "event_venue_idx" ON "event" USING btree ("venue_id");--> statement-breakpoint
CREATE INDEX "event_organizer_idx" ON "event" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "event_creator_idx" ON "event" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "event_catalog_idx" ON "event" USING btree ("status","category");--> statement-breakpoint
CREATE INDEX "reservation_item_idx" ON "inventory_reservation" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "reservation_expiry_idx" ON "inventory_reservation" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "invoice_order_idx" ON "invoice" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "invoice_payment_idx" ON "invoice" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "invoice_customer_idx" ON "invoice" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_item_type_idx" ON "order_item" USING btree ("ticket_type_id");--> statement-breakpoint
CREATE INDEX "order_promotion_promotion_idx" ON "order_promotion" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "order_user_idx" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_guest_email_idx" ON "order" USING btree ("buyer_email") WHERE "order"."user_id" is null;--> statement-breakpoint
CREATE INDEX "order_status_created_idx" ON "order" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payment_order_idx" ON "payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payout_organizer_idx" ON "payout" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "payout_event_idx" ON "payout" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "payout_account_idx" ON "payout" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE INDEX "payout_initiator_idx" ON "payout" USING btree ("initiated_by_id");--> statement-breakpoint
CREATE INDEX "payout_status_idx" ON "payout" USING btree ("status");--> statement-breakpoint
CREATE INDEX "promotion_ticket_type_type_idx" ON "promotion_ticket_type" USING btree ("ticket_type_id");--> statement-breakpoint
CREATE INDEX "promotion_event_idx" ON "promotion" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "refund_ticket_ticket_idx" ON "refund_ticket" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "refund_payment_idx" ON "refund" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refund_status_idx" ON "refund" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_type_session_session_idx" ON "ticket_type_session" USING btree ("event_session_id");--> statement-breakpoint
CREATE INDEX "ticket_type_event_idx" ON "ticket_type" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_item_unit_unique" ON "ticket" USING btree ("order_item_id","unit_number");--> statement-breakpoint
CREATE INDEX "user_role_role_idx" ON "user_role" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "venue_city_idx" ON "venue" USING btree ("city");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_provider_event_unique" ON "webhook_event" USING btree ("provider","external_event_id");--> statement-breakpoint
CREATE INDEX "webhook_pending_idx" ON "webhook_event" USING btree ("status","created_at");