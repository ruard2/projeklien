import { NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { submitCheckpoint } from "@/lib/diens";
import { currentGroupId } from "@/lib/sessie";

export async function POST(_req: Request, { params }: { params: Promise<{ n: string }> }) {
  return handle(async () => {
    const groupId = await currentGroupId();
    if (!groupId) return fout("Meld asseblief weer aan.", 401);
    const n = Number((await params).n);
    if (!Number.isInteger(n) || n < 1 || n > 20) return fout("Ongeldige kontrolepunt.");
    await submitCheckpoint(groupId, n);
    return NextResponse.json({ ok: true });
  });
}
