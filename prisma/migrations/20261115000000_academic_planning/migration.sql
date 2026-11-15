-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROPOSED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ConsultationFormat" AS ENUM ('IN_PERSON', 'ONLINE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONSULTATION';
ALTER TYPE "NotificationType" ADD VALUE 'COURSE_PLAN';

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "userId" UUID NOT NULL,
    "department" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "receptionHours" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ConsultationSlot" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "format" "ConsultationFormat" NOT NULL,
    "location" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConsultationSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationBooking" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "topic" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePlan" (
    "subjectId" UUID NOT NULL,
    "draft" JSONB,
    "draftRevision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoursePlan_pkey" PRIMARY KEY ("subjectId")
);

-- CreateTable
CREATE TABLE "CoursePlanVersion" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "authorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoursePlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseResult" (
    "enrollmentId" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "points" INTEGER,
    "status" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseResult_pkey" PRIMARY KEY ("enrollmentId","activityId")
);

-- CreateTable
CREATE TABLE "CalendarEntry" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "subjectId" UUID,
    "activityId" UUID,
    "title" TEXT,
    "startsAt" TIMESTAMP(3),
    "participation" BOOLEAN,

    CONSTRAINT "CalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationSlot_teacherId_startsAt_idx" ON "ConsultationSlot"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "ConsultationBooking_studentId_updatedAt_idx" ON "ConsultationBooking"("studentId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConsultationBooking_slotId_status_idx" ON "ConsultationBooking"("slotId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePlanVersion_subjectId_number_key" ON "CoursePlanVersion"("subjectId", "number");

-- CreateIndex
CREATE INDEX "CalendarEntry_studentId_startsAt_idx" ON "CalendarEntry"("studentId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEntry_studentId_subjectId_activityId_key" ON "CalendarEntry"("studentId", "subjectId", "activityId");

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSlot" ADD CONSTRAINT "ConsultationSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationBooking" ADD CONSTRAINT "ConsultationBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationBooking" ADD CONSTRAINT "ConsultationBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ConsultationSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePlan" ADD CONSTRAINT "CoursePlan_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePlanVersion" ADD CONSTRAINT "CoursePlanVersion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "CoursePlan"("subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePlanVersion" ADD CONSTRAINT "CoursePlanVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResult" ADD CONSTRAINT "CourseResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ConsultationBooking_active_slot"
ON "ConsultationBooking" ("slotId")
WHERE "status" IN ('PENDING', 'CONFIRMED', 'PROPOSED');

ALTER TABLE "ConsultationSlot" ADD CONSTRAINT "ConsultationSlot_positive_duration" CHECK ("startsAt" < "endsAt");

CREATE FUNCTION protect_published_course_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'A published course plan is immutable';
END;
$$;
CREATE TRIGGER "CoursePlanVersion_immutable"
BEFORE UPDATE OR DELETE ON "CoursePlanVersion"
FOR EACH ROW EXECUTE FUNCTION protect_published_course_plan();
