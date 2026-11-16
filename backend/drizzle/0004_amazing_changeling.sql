CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TABLE "payment_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "purchase_status" DEFAULT 'pending' NOT NULL,
	"receipt" text NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_amount_paise_check" CHECK ("purchase"."amount_paise" > 0),
	CONSTRAINT "purchase_currency_check" CHECK (char_length("purchase"."currency") = 3),
	CONSTRAINT "purchase_paid_fields_check" CHECK ("purchase"."status" <> 'paid' or ("purchase"."razorpay_order_id" is not null and "purchase"."razorpay_payment_id" is not null and "purchase"."paid_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "entitlement" ADD COLUMN "purchase_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_event_razorpay_order_id_idx" ON "payment_event" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "payment_event_razorpay_payment_id_idx" ON "payment_event" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_receipt_idx" ON "purchase" USING btree ("receipt");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_razorpay_order_id_idx" ON "purchase" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_razorpay_payment_id_idx" ON "purchase" USING btree ("razorpay_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_pending_user_course_idx" ON "purchase" USING btree ("user_id","course_id") WHERE "purchase"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "purchase_user_id_idx" ON "purchase" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchase_course_id_idx" ON "purchase" USING btree ("course_id");--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_purchase_id_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_purchase_id_idx" ON "entitlement" USING btree ("purchase_id");