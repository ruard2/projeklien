CREATE TABLE "FeedbackVote" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sheet" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "vote" INTEGER NOT NULL,
    "reason" TEXT,
    "chat" JSONB,
    "ruleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeedbackVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FeedbackVote_feedbackId_criterionId_teacherId_key" ON "FeedbackVote"("feedbackId", "criterionId", "teacherId");
CREATE INDEX "FeedbackVote_groupId_idx" ON "FeedbackVote"("groupId");
ALTER TABLE "FeedbackVote" ADD CONSTRAINT "FeedbackVote_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
