ALTER TABLE "AiRuleEvent" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "AiRuleEvent" ADD COLUMN "reviewedByName" TEXT;

CREATE TABLE "TeacherActivity" (
  "id" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "teacherName" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "link" TEXT,
  "details" JSONB,
  CONSTRAINT "TeacherActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeacherActivity_schoolId_at_idx" ON "TeacherActivity"("schoolId", "at");
CREATE INDEX "TeacherActivity_teacherId_at_idx" ON "TeacherActivity"("teacherId", "at");

-- Bestaande reëlhandelinge deur administrateurs/ontwikkelaars tel as nagegaan.
UPDATE "AiRuleEvent" e SET "reviewedAt" = e."at", "reviewedByName" = e."byName"
FROM "Teacher" t WHERE t."id" = e."byId" AND t."role" IN ('ADMIN', 'DEVELOPER');
