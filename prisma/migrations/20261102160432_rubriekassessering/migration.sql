-- CreateTable
CREATE TABLE "RubricAssessment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "rubricKey" TEXT NOT NULL,
    "rubricVersion" INTEGER NOT NULL,
    "workbookHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "promptVer" TEXT NOT NULL,
    "aiTotal" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "inputText" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RubricAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricMark" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "rubricKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'KONSEP',
    "scores" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "comment" TEXT,
    "assessors" TEXT,
    "assessmentId" TEXT,
    "teacherId" TEXT,
    "teacherName" TEXT NOT NULL,
    "finalisedAt" TIMESTAMP(3),
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RubricMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RubricAssessment_groupId_rubricKey_createdAt_idx" ON "RubricAssessment"("groupId", "rubricKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RubricMark_groupId_rubricKey_key" ON "RubricMark"("groupId", "rubricKey");

-- AddForeignKey
ALTER TABLE "RubricAssessment" ADD CONSTRAINT "RubricAssessment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricMark" ADD CONSTRAINT "RubricMark_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
