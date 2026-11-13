CREATE TYPE "DocumentDelivery" AS ENUM ('EMAIL', 'PICKUP', 'POSTAL');

ALTER TABLE "DocumentRequest"
  ADD COLUMN "delivery" "DocumentDelivery",
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "postalAddress" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedName" TEXT,
  ADD COLUMN "reviewedYear" INTEGER,
  ADD COLUMN "reviewedProgram" TEXT;

ALTER TABLE "Grade"
  ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "Grade_weight_positive" CHECK ("weight" > 0);

ALTER TABLE "Assessment"
  ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "Assessment_weight_positive" CHECK ("weight" > 0);
