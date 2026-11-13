ALTER TYPE "Role" ADD VALUE 'TEACHER';
ALTER TYPE "NotificationType" ADD VALUE 'TEACHER_REPLY';

ALTER TABLE "Assessment" ADD COLUMN "instructions" TEXT;
ALTER TABLE "Subject" ADD COLUMN "instructorId" UUID;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_instructorId_fkey"
  FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Subject_instructorId_idx" ON "Subject"("instructorId");

CREATE TABLE "CheckpointMessage" (
  "id" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckpointMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckpointMessage_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CheckpointMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CheckpointMessage_assessmentId_createdAt_idx" ON "CheckpointMessage"("assessmentId", "createdAt");
CREATE INDEX "CheckpointMessage_authorId_idx" ON "CheckpointMessage"("authorId");
