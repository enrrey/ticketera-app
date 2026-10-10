CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"encrypted_payload" text,
	"provider_message_id" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"claim_token" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "notification_status_check" CHECK ("notification_outbox"."status" in ('pending','processing','sent','failed','cancelled')),
	CONSTRAINT "notification_attempts_check" CHECK ("notification_outbox"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "confirmation_token_hash" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_retry_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_confirmation_token_hash_unique" UNIQUE("confirmation_token_hash");