ALTER TABLE "metrics_5s" ADD COLUMN "engaged" real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "poll_votes_student_id_index" ON "poll_votes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "question_votes_student_id_index" ON "question_votes" USING btree ("student_id");