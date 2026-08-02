-- Allow one managed clearance session for each semester of an academic year.
CREATE TYPE "Semester" AS ENUM ('FIRST', 'SECOND');

ALTER TABLE "AcademicSession"
  ADD COLUMN "semester" "Semester" NOT NULL DEFAULT 'FIRST';

DROP INDEX "AcademicSession_name_key";
CREATE UNIQUE INDEX "AcademicSession_name_semester_key"
  ON "AcademicSession"("name", "semester");
