ALTER TABLE "AiRule" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "AiRuleEvent" (
  "id" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ruleId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "byId" TEXT NOT NULL,
  "byName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldText" TEXT,
  "newText" TEXT,
  "note" TEXT,
  CONSTRAINT "AiRuleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiRuleEvent_schoolId_at_idx" ON "AiRuleEvent"("schoolId", "at");
CREATE INDEX "AiRuleEvent_ruleId_at_idx" ON "AiRuleEvent"("ruleId", "at");
ALTER TABLE "AiRuleEvent" ADD CONSTRAINT "AiRuleEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AiRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestaande reëls kry ’n "aangemaak"-gebeurtenis sodat die spoor volledig is.
INSERT INTO "AiRuleEvent" ("id", "at", "ruleId", "schoolId", "byId", "byName", "action", "newText")
SELECT 'mig_' || "id", "createdAt", "id", "schoolId", "createdById", "createdByName", 'aangemaak', "text" FROM "AiRule";
