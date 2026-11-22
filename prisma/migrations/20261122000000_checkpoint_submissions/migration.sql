ALTER TABLE "Assessment" ADD COLUMN "workStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
CREATE TABLE "CheckpointSubmission" (
  "id" UUID NOT NULL,
  "assessmentId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" UUID,
  "comment" TEXT,
  "points" INTEGER,
  "grade" INTEGER,
  CONSTRAINT "CheckpointSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckpointSubmission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CheckpointSubmission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CheckpointSubmission_status_check" CHECK ("status" IN ('SUBMITTED', 'REVISION', 'APPROVED'))
);
CREATE INDEX "CheckpointSubmission_assessmentId_submittedAt_idx" ON "CheckpointSubmission"("assessmentId", "submittedAt");
INSERT INTO "CheckpointSubmission" ("id", "assessmentId", "body", "submittedAt", "status")
SELECT m."id", m."assessmentId", substring(m."body" FROM length('Работа на проверку') + 2), m."createdAt",
       CASE WHEN a."passedAt" IS NOT NULL THEN 'APPROVED' ELSE 'SUBMITTED' END
FROM "CheckpointMessage" m JOIN "Assessment" a ON a."id"=m."assessmentId"
JOIN "User" u ON u."id"=m."authorId"
WHERE u."role"='STUDENT' AND m."body" LIKE E'Работа на проверку\n%';
UPDATE "Assessment" a SET "workStatus"='SUBMITTED'
WHERE a."passedAt" IS NULL AND EXISTS (SELECT 1 FROM "CheckpointSubmission" s WHERE s."assessmentId"=a."id");
