import { NextResponse } from "next/server";
import { fout } from "@/lib/api";
import { currentTeacher } from "@/lib/sessie";
import { devFeedbackRows, toCsv } from "@/lib/terugvoer-uitvoer";

export const dynamic = "force-dynamic";

/** Uitvoer van alle onderwyser-terugvoer: ?formaat=csv (verstek, vir Excel) of ?formaat=json */
export async function GET(req: Request) {
  const t = await currentTeacher();
  if (!t || t.role !== "ADMIN") return fout("Geen toegang nie.", 403);
  const url = new URL(req.url);
  const rows = await devFeedbackRows(t.schoolId, { status: url.searchParams.get("status") || undefined });
  const stamp = new Date().toISOString().slice(0, 10);
  if (url.searchParams.get("formaat") === "json") {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="vol-terugvoer-${stamp}.json"` }
    });
  }
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vol-terugvoer-${stamp}.csv"` }
  });
}
