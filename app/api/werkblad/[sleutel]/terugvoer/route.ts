import { NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { requestFeedback } from "@/lib/diens";
import { currentGroupId } from "@/lib/sessie";
import { allow } from "@/lib/tempo";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: Promise<{ sleutel: string }> }) {
  return handle(async () => {
    const groupId = await currentGroupId();
    if (!groupId) return fout("Meld asseblief weer aan.", 401);
    const sheet = decodeURIComponent((await params).sleutel);

    const perSheet = Number(process.env.FEEDBACK_MIN_SECONDS || 20);
    const perHour = Number(process.env.FEEDBACK_PER_HOUR || 40);
    if (!(await allow(`tv:${groupId}:${sheet}`, 1, perSheet))) {
      return fout("Gee julleself eers ’n oomblik om die terugvoer te lees en julle werk te verbeter voordat julle weer vra.", 429);
    }
    if (!(await allow(`tv:${groupId}`, perHour, 3600))) {
      return fout("Julle het hierdie uur al baie terugvoer gevra. Probeer later weer, of vra julle onderwyser.", 429);
    }

    const { feedback, ready } = await requestFeedback(groupId, sheet);
    return NextResponse.json({
      feedback: { id: feedback.id, result: feedback.result, ready, source: feedback.source, createdAt: feedback.createdAt.toISOString() }
    });
  });
}
