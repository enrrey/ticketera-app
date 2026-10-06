ALTER TABLE "order" ADD COLUMN "access_token_hash" text;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_access_token_hash_unique" UNIQUE("access_token_hash");