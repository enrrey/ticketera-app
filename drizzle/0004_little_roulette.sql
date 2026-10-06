CREATE TABLE "staff_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"clerk_invitation_id" text,
	"roles" jsonb NOT NULL,
	"overrides" jsonb NOT NULL,
	"invited_by_id" uuid NOT NULL,
	"accepted_by_id" uuid,
	"status" text DEFAULT 'sending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invitation_email_unique" UNIQUE("email"),
	CONSTRAINT "staff_invitation_clerk_invitation_id_unique" UNIQUE("clerk_invitation_id"),
	CONSTRAINT "staff_invitation_status_check" CHECK ("staff_invitation"."status" in ('sending', 'pending', 'accepted', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "staff_invitation" ADD CONSTRAINT "staff_invitation_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitation" ADD CONSTRAINT "staff_invitation_accepted_by_id_user_id_fk" FOREIGN KEY ("accepted_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_invitation_inviter_idx" ON "staff_invitation" USING btree ("invited_by_id");--> statement-breakpoint
CREATE INDEX "staff_invitation_acceptor_idx" ON "staff_invitation" USING btree ("accepted_by_id");