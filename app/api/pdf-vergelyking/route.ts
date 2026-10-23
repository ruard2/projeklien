import { after, NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ki";
import { runExtraction } from "@/lib/pdf-vergelyking/diens";
import { pdfModel } from "@/lib/pdf-vergelyking/openai";
import { currentTeacher } from "@/lib/sessie";
import { allow } from "@/lib/tempo";
import { logActivity } from "@/lib/aktiwiteit";

const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(req: Request) {
  return handle(async () => {
    const t = await currentTeacher();
    if (!t) return fout("Meld asseblief weer aan.", 401);
    if (!aiConfigured()) return fout("Die KI is nie op hierdie bediener opgestel nie (OPENAI_API_KEY ontbreek).", 503);
    if (!(await allow(`pdf:${t.id}`, 10, 3600))) return fout("Te veel oplaaie in ’n kort tyd. Probeer later weer.", 429);

    const form = await req.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") ?? "");
    if (form.get("consent") !== "1") return fout("Bevestig asseblief dat die skandering na OpenAI gestuur mag word.");
    if (!(file instanceof Blob) || file.size === 0) return fout("Geen PDF ontvang nie.");
    if (file.size > MAX_BYTES) return fout("Die PDF is te groot (hoogstens 30 MB).");

    const groupId = String(form.get("groupId") ?? "") || null;
    const group = groupId ? await db.group.findFirst({ where: { id: groupId, project: { schoolId: t.schoolId } }, select: { id: true, projectId: true } }) : null;
    if (groupId && !group) return fout("Groep nie gevind nie.");
    const project = await db.project.findFirst({ where: { id: group?.projectId ?? projectId, schoolId: t.schoolId } });
    if (!project) return fout("Kies asseblief graad 8 of graad 9.");

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.subarray(0, 5).toString() !== "%PDF-") return fout("Slegs PDF-lêers.");
    const name = (file instanceof File ? file.name : "werkboek.pdf").slice(0, 120);

    const c = await db.pdfComparison.create({
      data: { schoolId: t.schoolId, teacherId: t.id, teacherName: t.name, projectId: project.id, groupId: group?.id ?? null, model: pdfModel(form.get("kwaliteit") === "vinnig" ? "vinnig" : "beste"), templateKey: project.templateKey, fileName: name, pdf: buf },
      select: { id: true }
    });
    await logActivity(t, "pdf", `PDF opgelaai: ${name} · ${project.title}`, { link: `/onderwyser/pdf-vergelyking/${c.id}` });
    after(() => runExtraction(c.id));
    return NextResponse.json({ id: c.id });
  });
}
