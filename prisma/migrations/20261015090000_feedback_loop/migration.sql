-- Aparte ontwikkelaarrol.
ALTER TYPE "TeacherRole" ADD VALUE IF NOT EXISTS 'DEVELOPER' BEFORE 'ADMIN';

-- Presiese KI-opdragweergawe per antwoord.
ALTER TABLE "Feedback" ADD COLUMN "promptVer" TEXT NOT NULL DEFAULT 'v1';

-- Gestruktureerde, tweerigting-ontwikkelaarterugvoer.
ALTER TABLE "DevFeedback"
  ADD COLUMN "issueType" TEXT,
  ADD COLUMN "expectedVerdict" TEXT,
  ADD COLUMN "scope" TEXT,
  ADD COLUMN "developerReply" TEXT,
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "regressionStatus" TEXT NOT NULL DEFAULT 'nie';

CREATE INDEX "DevFeedback_teacherId_createdAt_idx" ON "DevFeedback"("teacherId", "createdAt");

-- Leerderverslae oor KI-antwoorde.
CREATE TABLE "AiReport" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "sheet" TEXT NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'nuut',
  "devNote" TEXT,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiReport_schoolId_status_createdAt_idx" ON "AiReport"("schoolId", "status", "createdAt");
CREATE INDEX "AiReport_groupId_sheet_createdAt_idx" ON "AiReport"("groupId", "sheet", "createdAt");
