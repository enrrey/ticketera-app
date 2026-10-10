ALTER TABLE "refund" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "refund" ADD COLUMN "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL;