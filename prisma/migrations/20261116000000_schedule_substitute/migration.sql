ALTER TABLE "ScheduleEvent" ADD COLUMN "teacherOverrideId" UUID;

ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_teacherOverrideId_fkey"
FOREIGN KEY ("teacherOverrideId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ScheduleEvent_teacherOverrideId_start_idx" ON "ScheduleEvent"("teacherOverrideId", "start");
