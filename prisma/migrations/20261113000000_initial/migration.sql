-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEW', 'APPROVED', 'REJECTED', 'READY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CERTIFICATE', 'APPLICATION', 'CONSULTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE', 'GRADE', 'DEADLINE', 'DOCUMENT', 'ACHIEVEMENT', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "QuestKind" AS ENUM ('PERSONAL', 'LAB', 'CREDIT');

-- CreateEnum
CREATE TYPE "XpKind" AS ENUM ('PERSONAL', 'LAB', 'CREDIT', 'STAGE', 'SEMESTER');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "login" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "facultyId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "program" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "animations" BOOLEAN NOT NULL DEFAULT true,
    "reminders" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "userId" UUID NOT NULL,
    "facultyId" UUID,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "teacher" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "finalGrade" INTEGER,
    "creditPassed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "room" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleChange" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "previous" JSONB NOT NULL,
    "current" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "passedAt" TIMESTAMP(3),

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "room" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "assessmentId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "kind" "QuestKind" NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCompletion" (
    "questId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedBy" TEXT NOT NULL,

    CONSTRAINT "QuestCompletion_pkey" PRIMARY KEY ("questId")
);

-- CreateTable
CREATE TABLE "SemesterStage" (
    "id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "SemesterStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSemesterProgress" (
    "studentId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSemesterProgress_pkey" PRIMARY KEY ("studentId","stageId")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" "XpKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "studentId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("studentId","achievementId")
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "recipient" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentStatusHistory" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "eventKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_name_key" ON "Faculty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE INDEX "StudentProfile_groupId_idx" ON "StudentProfile"("groupId");

-- CreateIndex
CREATE INDEX "StudentProfile_facultyId_idx" ON "StudentProfile"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_subjectId_key" ON "Enrollment"("studentId", "subjectId");

-- CreateIndex
CREATE INDEX "ScheduleEvent_groupId_start_idx" ON "ScheduleEvent"("groupId", "start");

-- CreateIndex
CREATE INDEX "ScheduleChange_eventId_createdAt_idx" ON "ScheduleChange"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Grade_enrollmentId_assessedAt_idx" ON "Grade"("enrollmentId", "assessedAt");

-- CreateIndex
CREATE INDEX "Assessment_enrollmentId_due_idx" ON "Assessment"("enrollmentId", "due");

-- CreateIndex
CREATE INDEX "Exam_enrollmentId_start_idx" ON "Exam"("enrollmentId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "Quest_assessmentId_key" ON "Quest"("assessmentId");

-- CreateIndex
CREATE INDEX "Quest_studentId_due_idx" ON "Quest"("studentId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "SemesterStage_position_key" ON "SemesterStage"("position");

-- CreateIndex
CREATE UNIQUE INDEX "XpEvent_studentId_eventKey_key" ON "XpEvent"("studentId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE INDEX "StudentAchievement_studentId_earnedAt_idx" ON "StudentAchievement"("studentId", "earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_number_key" ON "DocumentRequest"("number");

-- CreateIndex
CREATE INDEX "DocumentRequest_studentId_createdAt_idx" ON "DocumentRequest"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_updatedAt_idx" ON "DocumentRequest"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "DocumentStatusHistory_documentId_createdAt_idx" ON "DocumentStatusHistory"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_eventKey_key" ON "Notification"("userId", "eventKey");

-- CreateIndex
CREATE INDEX "Announcement_groupId_publishedAt_idx" ON "Announcement"("groupId", "publishedAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetId_createdAt_idx" ON "AuditLog"("targetId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_expiresAt_idx" ON "LoginAttempt"("expiresAt");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEvent" ADD CONSTRAINT "ScheduleEvent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChange" ADD CONSTRAINT "ScheduleChange_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ScheduleEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SemesterStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCompletion" ADD CONSTRAINT "QuestCompletion_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSemesterProgress" ADD CONSTRAINT "StudentSemesterProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSemesterProgress" ADD CONSTRAINT "StudentSemesterProgress_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SemesterStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStatusHistory" ADD CONSTRAINT "DocumentStatusHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStatusHistory" ADD CONSTRAINT "DocumentStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
