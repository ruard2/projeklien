import { NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { saveSheet } from "@/lib/diens";
import { currentGroupId } from "@/lib/sessie";

export async function PUT(req: Request, { params }: { params: Promise<{ sleutel: string }> }) {
  return handle(async () => {
    const groupId = await currentGroupId();
    if (!groupId) return fout("Meld asseblief weer aan.", 401);
    const { sleutel } = await params;
    const body = (await req.json().catch(() => null)) as { data?: unknown; revision?: unknown } | null;
    if (!body || typeof body.revision !== "number") return fout("Ongeldige versoek.");
    const out = await saveSheet(groupId, decodeURIComponent(sleutel), body.data, body.revision);
    return NextResponse.json(out);
  });
}
