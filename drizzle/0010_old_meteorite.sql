ALTER TABLE "webhook_event" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_event" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_event" ADD COLUMN "claim_token" uuid;--> statement-breakpoint
CREATE INDEX "webhook_retry_idx" ON "webhook_event" USING btree ("provider","status","next_attempt_at");