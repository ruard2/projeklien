import { NextResponse } from "next/server";
import { logActivity } from "@/lib/aktiwiteit";
import { fout, handle } from "@/lib/api";
import { runAssessment } from "@/lib/assessering/diens";
import { currentTeacher } from "@/lib/sessie";
import { allow } from "@/lib/tempo";

export const maxDuration = 300;

/** Laat die KI een groep se werkboek volgens die rubriek beoordeel (slegs onderwysers). */
export async function POST(req: Request, { params }: { params: Promise<{ groep: string }> }) {
  return handle(async () => {
    const t = await currentTeacher();
    if (!t) return fout("Meld asseblief weer aan.", 401);
    if (!(await allow(`assessering:${t.schoolId}`, 400, 3600))) return fout("Te veel beoordelings hierdie uur. Probeer later weer.", 429);
    const { groep } = await params;
    const body = (await req.json().catch(() => ({}))) as { force?: unknown };
    const outcome = await runAssessment(t.schoolId, groep, t.name, body.force === true);
    if (outcome.status === "klaar") {
      await logActivity(t, "assessering", `KI het ’n groep volgens die rubriek beoordeel (${outcome.total}/50)`, { link: `/onderwyser/assessering/${groep}` });
    }
    return NextResponse.json(outcome);
  });
}
