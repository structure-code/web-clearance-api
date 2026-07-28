-- AlterTable
ALTER TABLE "ClearanceRequest" ADD COLUMN     "clearedAt" TIMESTAMP(3),
ADD COLUMN     "clearedByOfficerName" TEXT,
ADD COLUMN     "clearedBySignatureUrl" TEXT;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "requiredDocumentDescription" TEXT,
ADD COLUMN     "requiresDocument" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signatureUrl" TEXT;
