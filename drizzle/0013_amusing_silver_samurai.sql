CREATE TABLE "seat_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"zone_key" text NOT NULL,
	"row_key" text NOT NULL,
	"row_label" text NOT NULL,
	"seat_number" integer NOT NULL,
	"owner_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '60 seconds' NOT NULL,
	CONSTRAINT "seat_hold_values_check" CHECK ("seat_hold"."seat_number" between 1 and 500 and length("seat_hold"."row_label") between 1 and 20 and length("seat_hold"."owner_token_hash")=64 and "seat_hold"."expires_at">"seat_hold"."created_at")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "seating_layout" jsonb DEFAULT '{"enabled":false,"template":"stadium","stagePosition":"north"}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_type" ADD COLUMN "map_position" text DEFAULT 'west' NOT NULL;--> statement-breakpoint
ALTER TABLE "seat_hold" ADD CONSTRAINT "seat_hold_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_hold" ADD CONSTRAINT "seat_hold_ticket_type_id_event_id_ticket_type_id_event_id_fk" FOREIGN KEY ("ticket_type_id","event_id") REFERENCES "public"."ticket_type"("id","event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seat_hold_physical_unique" ON "seat_hold" USING btree ("event_id","zone_key","row_key","seat_number");--> statement-breakpoint
CREATE INDEX "seat_hold_owner_idx" ON "seat_hold" USING btree ("event_id","owner_token_hash");--> statement-breakpoint
CREATE INDEX "seat_hold_expiry_idx" ON "seat_hold" USING btree ("expires_at");
--> statement-breakpoint
UPDATE event SET seating_layout=jsonb_set(seating_layout,'{enabled}','true'::jsonb) WHERE EXISTS (SELECT 1 FROM ticket_type tt WHERE tt.event_id=event.id AND tt.seating_type='numbered');
