import { NextResponse } from "next/server";
import { fout } from "@/lib/api";
import { aiReportRows, reportRowsToCsv } from "@/lib/ki-verslag-uitvoer";
import { canReviewFeedback, currentTeacher } from "@/lib/sessie";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const teacher = await currentTeacher();
  if (!teacher || !canReviewFeedback(teacher.role)) return fout("Geen toegang nie.", 403);
  const rows = await aiReportRows(teacher.schoolId);
  const url = new URL(req.url);
  const stamp = new Date().toISOString().slice(0, 10);
  if (url.searchParams.get("formaat") === "json") {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="vol-ki-verslae-${stamp}.json"` }
    });
  }
  return new NextResponse(reportRowsToCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vol-ki-verslae-${stamp}.csv"` }
  });
}
