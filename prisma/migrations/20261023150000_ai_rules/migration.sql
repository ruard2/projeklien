ALTER TABLE "PdfVote" ADD COLUMN "reason" TEXT;
ALTER TABLE "PdfVote" ADD COLUMN "chat" JSONB;
ALTER TABLE "PdfVote" ADD COLUMN "ruleId" TEXT;

CREATE TABLE "AiRule" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "sheet" TEXT,
  "criterionId" TEXT,
  "text" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sourceComparisonId" TEXT,
  CONSTRAINT "AiRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiRule_schoolId_templateKey_active_idx" ON "AiRule"("schoolId", "templateKey", "active");
ALTER TABLE "AiRule" ADD CONSTRAINT "AiRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
