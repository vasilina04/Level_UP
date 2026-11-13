ALTER TABLE "ScheduleEvent"
  ADD COLUMN "building" TEXT,
  ADD COLUMN "teacherOverride" TEXT,
  ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

UPDATE "ScheduleEvent"
SET "building" = CASE
  WHEN "format" = 'Онлайн' THEN NULL
  WHEN "room" LIKE 'Б-%' THEN 'Корпус Б'
  ELSE 'Корпус А'
END;
