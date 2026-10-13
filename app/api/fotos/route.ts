import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { putObject, storageDriver } from "@/lib/berging";
import { db } from "@/lib/db";
import { getSheetState } from "@/lib/diens";
import { currentGroupId } from "@/lib/sessie";
import { allow } from "@/lib/tempo";

const MAX_BYTES = 4 * 1024 * 1024;

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function POST(req: Request) {
  return handle(async () => {
    const groupId = await currentGroupId();
    if (!groupId) return fout("Meld asseblief weer aan.", 401);
    if (!(await allow(`foto:${groupId}`, 60, 3600))) return fout("Te veel foto’s in ’n kort tyd. Probeer later weer.", 429);

    const form = await req.formData();
    const sheetKey = String(form.get("sheet") ?? "");
    const field = String(form.get("field") ?? "");
    const caption = String(form.get("caption") ?? "").trim().slice(0, 140) || null;
    const file = form.get("file");
    if (form.get("consent") !== "1") return fout("Bevestig asseblief die toestemming.");
    if (!(file instanceof Blob)) return fout("Geen foto ontvang nie.");
    if (file.size > MAX_BYTES) return fout("Die foto is te groot.");

    const { sheet, access } = await getSheetState(groupId, sheetKey);
    if (!access.editable) return fout(access.reason ?? "Hierdie werkblad is gesluit.", 423);
    const def = sheet.sections.flatMap((s) => s.fields).find((f) => f.key === field && f.type === "photos");
    if (!def || def.type !== "photos") return fout("Hier kan nie foto’s gelaai word nie.");
    const count = await db.photo.count({ where: { groupId, sheet: sheetKey, field } });
    if (count >= def.max) return fout(`Hoogstens ${def.max} foto’s hier.`);

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniff(buf);
    if (!mime) return fout("Slegs JPG-, PNG- of WebP-foto’s.");

    const driver = storageDriver();
    let storageKey: string | null = null;
    if (driver === "s3") {
      storageKey = `fotos/${groupId}/${randomUUID()}`;
      await putObject(storageKey, buf, mime);
    }
    const photo = await db.photo.create({
      data: { groupId, sheet: sheetKey, field, mime, size: buf.length, caption, storage: driver, storageKey, bytes: driver === "db" ? buf : null },
      select: { id: true, field: true, caption: true }
    });
    return NextResponse.json({ photo });
  });
}
