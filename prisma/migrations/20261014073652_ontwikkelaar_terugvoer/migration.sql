-- CreateTable
CREATE TABLE "DevFeedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT,
    "teacherName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "rating" TEXT,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "groupId" TEXT,
    "sheet" TEXT,
    "feedbackId" TEXT,
    "criterionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'nuut',
    "devNote" TEXT,

    CONSTRAINT "DevFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DevFeedback_schoolId_createdAt_idx" ON "DevFeedback"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "DevFeedback_status_idx" ON "DevFeedback"("status");
