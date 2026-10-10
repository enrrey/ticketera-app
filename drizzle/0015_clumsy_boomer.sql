CREATE TABLE "organizer_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"ruc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizer_profile_ruc_check" CHECK ("organizer_profile"."ruc" ~ '^[0-9]{11}$')
);
--> statement-breakpoint
ALTER TABLE "inventory_reservation" DROP CONSTRAINT "reservation_values_check";--> statement-breakpoint
ALTER TABLE "inventory_reservation" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '10 minutes';--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "buyer_document_type" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "buyer_document_encrypted" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "buyer_phone" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizer_profile" ADD CONSTRAINT "organizer_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservation" ADD CONSTRAINT "reservation_values_check" CHECK ("inventory_reservation"."quantity" > 0 and ("inventory_reservation"."expires_at" = "inventory_reservation"."created_at" + interval '10 minutes' or "inventory_reservation"."expires_at" = "inventory_reservation"."created_at" + interval '15 minutes'));