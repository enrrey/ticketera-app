CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "permission_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "super_admin_assignment" (
	"key" text PRIMARY KEY DEFAULT 'primary' NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "super_admin_assignment_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "super_admin_singleton_check" CHECK ("super_admin_assignment"."key" = 'primary')
);
--> statement-breakpoint
CREATE TABLE "user_permission" (
	"user_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"allowed" boolean NOT NULL,
	CONSTRAINT "user_permission_user_id_permission_id_pk" PRIMARY KEY("user_id","permission_id")
);
--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_assignment" ADD CONSTRAINT "super_admin_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission" ADD CONSTRAINT "user_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_permission_permission_idx" ON "role_permission" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "user_permission_permission_idx" ON "user_permission" USING btree ("permission_id");--> statement-breakpoint
INSERT INTO "role" ("name") VALUES ('customer'), ('admin'), ('organizer'), ('super_admin') ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
INSERT INTO "permission" ("name", "description") VALUES
  ('staff.manage', 'Gestionar usuarios, roles y permisos'),
  ('events.manage', 'Gestionar eventos'), ('events.publish', 'Publicar eventos'),
  ('tickets.check_in', 'Validar entradas'), ('refunds.manage', 'Gestionar reembolsos'),
  ('settlements.manage', 'Gestionar liquidaciones'), ('tickets.read_own', 'Consultar sus propias entradas')
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT r.id, p.id FROM "role" r CROSS JOIN "permission" p WHERE
  r.name = 'super_admin'
  OR (r.name = 'customer' AND p.name = 'tickets.read_own')
  OR (r.name = 'admin' AND p.name <> 'staff.manage')
  OR (r.name = 'organizer' AND p.name IN ('events.manage', 'events.publish', 'tickets.check_in', 'tickets.read_own'))
ON CONFLICT DO NOTHING;
