ALTER TABLE "event" ADD COLUMN "minimum_age" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "entry_instructions" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_type" ADD COLUMN "zone" text DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_type" ADD COLUMN "seating_type" text DEFAULT 'standing' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_type" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_type" ADD COLUMN "max_per_order" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_type" ADD COLUMN "people_per_unit" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_minimum_age_check" CHECK ("event"."minimum_age" between 0 and 99);--> statement-breakpoint
ALTER TABLE "ticket_type" ADD CONSTRAINT "ticket_type_seating_check" CHECK ("ticket_type"."seating_type" in ('standing','seated','box') and "ticket_type"."max_per_order" between 1 and 1000 and "ticket_type"."people_per_unit" between 1 and 50 and ("ticket_type"."seating_type"='box' or "ticket_type"."people_per_unit"=1));