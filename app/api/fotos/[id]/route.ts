import { NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { deleteObject, getObject } from "@/lib/berging";
import { db } from "@/lib/db";
import { getSheetState } from "@/lib/diens";
import { currentGroupId, currentTeacher } from "@/lib/sessie";

async function load(id: string) {
  return db.photo.findUnique({
    where: { id },
    select: { id: true, groupId: true, sheet: true, mime: true, storage: true, storageKey: true, group: { select: { project: { select: { schoolId: true } } } } }
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const photo = await load((await params).id);
    if (!photo) return fout("Nie gevind nie.", 404);
    const groupId = await currentGroupId();
    let allowed = groupId === photo.groupId;
    if (!allowed) {
      const t = await currentTeacher();
      allowed = Boolean(t && t.schoolId === photo.group.project.schoolId);
    }
    if (!allowed) return fout("Geen toegang nie.", 403);
    const bytes =
      photo.storage === "s3" && photo.storageKey
        ? await getObject(photo.storageKey)
        : (await db.photo.findUnique({ where: { id: photo.id }, select: { bytes: true } }))?.bytes;
    if (!bytes) return fout("Nie gevind nie.", 404);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" }
    });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const groupId = await currentGroupId();
    const photo = await load((await params).id);
    if (!photo || photo.groupId !== groupId) return fout("Nie gevind nie.", 404);
    const { access } = await getSheetState(groupId, photo.sheet);
    if (!access.editable) return fout(access.reason ?? "Hierdie werkblad is gesluit.", 423);
    await db.photo.delete({ where: { id: photo.id } });
    if (photo.storage === "s3" && photo.storageKey) await deleteObject(photo.storageKey).catch(() => undefined);
    return NextResponse.json({ ok: true });
  });
}
