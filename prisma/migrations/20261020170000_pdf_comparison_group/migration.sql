ALTER TABLE "PdfComparison" ADD COLUMN "groupId" TEXT;
CREATE INDEX "PdfComparison_groupId_idx" ON "PdfComparison"("groupId");
