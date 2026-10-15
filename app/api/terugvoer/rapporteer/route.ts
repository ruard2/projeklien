import { NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { db } from "@/lib/db";
import { currentGroupId } from "@/lib/sessie";
import { allow } from "@/lib/tempo";
import { parseAiReport } from "@/lib/terugvoer-beheer";

export async function POST(req: Request) {
  return handle(async () => {
    const groupId = await currentGroupId();
    if (!groupId) return fout("Meld asseblief weer aan.", 401);
    if (!(await allow(`ki-verslag:${groupId}`, 8, 3600))) return fout("Julle het onlangs reeds verskeie verslae gestuur. Vra asseblief die onderwyser vir hulp.", 429);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const feedbackId = typeof body?.feedbackId === "string" ? body.feedbackId : "";
    const sheet = typeof body?.sheet === "string" ? decodeURIComponent(body.sheet).slice(0, 40) : "";
    let report;
    try {
      report = parseAiReport(body);
    } catch (e) {
      return fout(e instanceof Error ? e.message : "Ongeldige verslag.");
    }

    const feedback = await db.feedback.findFirst({ where: { id: feedbackId, groupId, sheet }, include: { group: { include: { project: true } } } });
    if (!feedback) return fout("Hierdie KI-antwoord kon nie gevind word nie.", 404);

    const existing = await db.aiReport.findUnique({ where: { groupId_feedbackId: { groupId, feedbackId } }, select: { id: true } });
    if (existing) return NextResponse.json({ ok: true, existing: true });

    await db.aiReport.create({
      data: { schoolId: feedback.group.project.schoolId, groupId, sheet, feedbackId, category: report.category, message: report.message }
    });
    return NextResponse.json({ ok: true });
  });
}
