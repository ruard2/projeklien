ALTER TABLE "Feedback" ADD COLUMN "inputSnapshot" JSONB;

CREATE TABLE "AiEvalCase" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "sourceDevFeedbackId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "sheet" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "criterionId" TEXT NOT NULL,
  "expectedVerdict" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "lastPassed" BOOLEAN,
  "lastSummary" TEXT,
  "lastResult" JSONB,
  CONSTRAINT "AiEvalCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiEvalCase_sourceDevFeedbackId_key" ON "AiEvalCase"("sourceDevFeedbackId");
CREATE INDEX "AiEvalCase_schoolId_active_idx" ON "AiEvalCase"("schoolId", "active");
CREATE INDEX "AiEvalCase_lastPassed_idx" ON "AiEvalCase"("lastPassed");
ALTER TABLE "AiEvalCase" ADD CONSTRAINT "AiEvalCase_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
