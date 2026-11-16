CREATE TYPE "public"."video_upload_status" AS ENUM('initiated', 'completed', 'aborted');--> statement-breakpoint
CREATE TABLE "video_upload" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"provider_upload_id" text NOT NULL,
	"object_key" text NOT NULL,
	"video_name" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"part_size_bytes" integer NOT NULL,
	"part_count" integer NOT NULL,
	"duration_seconds" integer,
	"status" "video_upload_status" DEFAULT 'initiated' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"video_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_upload_size_bytes_check" CHECK ("video_upload"."size_bytes" > 0),
	CONSTRAINT "video_upload_part_size_bytes_check" CHECK ("video_upload"."part_size_bytes" >= 5242880),
	CONSTRAINT "video_upload_part_count_check" CHECK ("video_upload"."part_count" between 1 and 10000),
	CONSTRAINT "video_upload_duration_seconds_check" CHECK ("video_upload"."duration_seconds" is null or "video_upload"."duration_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "video_upload" ADD CONSTRAINT "video_upload_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_upload" ADD CONSTRAINT "video_upload_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_upload" ADD CONSTRAINT "video_upload_video_id_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."video"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_upload_object_key_idx" ON "video_upload" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "video_upload_video_id_idx" ON "video_upload" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "video_upload_course_id_idx" ON "video_upload" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "video_upload_created_by_idx" ON "video_upload" USING btree ("created_by");