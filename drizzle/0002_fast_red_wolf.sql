ALTER TABLE "user" ADD COLUMN "identity_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "admin_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "user" SET "identity_disabled" = true WHERE "status" = 'inactive';
