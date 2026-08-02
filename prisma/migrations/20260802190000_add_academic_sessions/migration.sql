-- Create administrator-managed academic sessions.
CREATE TABLE "AcademicSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcademicSession_name_key" ON "AcademicSession"("name");

-- Preserve existing requests and certificates by placing them in an inactive legacy session.
INSERT INTO "AcademicSession" ("id", "name", "isActive", "updatedAt")
VALUES ('legacy-academic-session', 'Legacy / Unassigned', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "ClearanceRequest" ADD COLUMN "academicSessionId" TEXT;
UPDATE "ClearanceRequest" SET "academicSessionId" = 'legacy-academic-session' WHERE "academicSessionId" IS NULL;
ALTER TABLE "ClearanceRequest" ALTER COLUMN "academicSessionId" SET NOT NULL;

ALTER TABLE "Certificate" ADD COLUMN "academicSessionId" TEXT;
UPDATE "Certificate" SET "academicSessionId" = 'legacy-academic-session' WHERE "academicSessionId" IS NULL;
ALTER TABLE "Certificate" ALTER COLUMN "academicSessionId" SET NOT NULL;

DROP INDEX "Certificate_studentId_key";
CREATE UNIQUE INDEX "Certificate_studentId_academicSessionId_key" ON "Certificate"("studentId", "academicSessionId");

ALTER TABLE "ClearanceRequest" ADD CONSTRAINT "ClearanceRequest_academicSessionId_fkey"
  FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_academicSessionId_fkey"
  FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
