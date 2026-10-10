CREATE TABLE "order_item_seat" (
	"order_item_id" uuid NOT NULL,
	"unit_number" integer NOT NULL,
	"row_label" text NOT NULL,
	"seat_number" integer NOT NULL,
	CONSTRAINT "order_item_seat_order_item_id_unit_number_pk" PRIMARY KEY("order_item_id","unit_number"),
	CONSTRAINT "order_item_seat_values_check" CHECK ("order_item_seat"."unit_number" > 0 and "order_item_seat"."seat_number" > 0 and length(trim("order_item_seat"."row_label")) between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "order_item_seat" ADD CONSTRAINT "order_item_seat_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_item_seat_position_unique" ON "order_item_seat" USING btree ("order_item_id","row_label","seat_number");