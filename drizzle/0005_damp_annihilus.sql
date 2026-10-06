ALTER TABLE "staff_invitation" DROP CONSTRAINT "staff_invitation_email_unique";--> statement-breakpoint
ALTER TABLE "staff_invitation" DROP CONSTRAINT "staff_invitation_status_check";--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invitation_open_email_idx" ON "staff_invitation" USING btree ("email") WHERE "staff_invitation"."status" in ('sending', 'pending', 'failed');--> statement-breakpoint
ALTER TABLE "staff_invitation" ADD CONSTRAINT "staff_invitation_status_check" CHECK ("staff_invitation"."status" in ('sending', 'pending', 'accepted', 'failed', 'expired'));