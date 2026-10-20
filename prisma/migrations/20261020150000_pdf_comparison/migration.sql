CREATE TABLE "PdfComparison" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "schoolId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "teacherName" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "pdf" BYTEA,
  "status" TEXT NOT NULL DEFAULT 'uitlees',
  "error" TEXT,
  "extracted" JSONB,
  "results" JSONB,
  "model" TEXT,
  CONSTRAINT "PdfComparison_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PdfComparison_schoolId_teacherId_createdAt_idx" ON "PdfComparison"("schoolId", "teacherId", "createdAt");
ALTER TABLE "PdfComparison" ADD CONSTRAINT "PdfComparison_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PdfVote" (
  "id" TEXT NOT NULL,
  "comparisonId" TEXT NOT NULL,
  "sheet" TEXT NOT NULL,
  "criterionId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "vote" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PdfVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PdfVote_comparisonId_sheet_criterionId_teacherId_key" ON "PdfVote"("comparisonId", "sheet", "criterionId", "teacherId");
ALTER TABLE "PdfVote" ADD CONSTRAINT "PdfVote_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "PdfComparison"("id") ON DELETE CASCADE ON UPDATE CASCADE;
