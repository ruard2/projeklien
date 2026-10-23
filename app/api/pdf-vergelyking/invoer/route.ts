import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { db } from "@/lib/db";
import { parseImport } from "@/lib/pdf-vergelyking/invoer";
import { currentTeacher } from "@/lib/sessie";
import { logActivity } from "@/lib/aktiwiteit";

export async function POST(req: Request) {
  return handle(async () => {
    const t = await currentTeacher();
    if (!t) return fout("Meld asseblief weer aan.", 401);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) return fout("Geen lêer ontvang nie.");
    if (file.size > 10 * 1024 * 1024) return fout("Die lêer is te groot.");
    let items;
    try {
      items = parseImport(JSON.parse(await file.text()));
    } catch (e) {
      return fout(e instanceof SyntaxError ? "Dit is nie ’n geldige JSON-lêer nie." : e instanceof Error ? e.message : "Ongeldige lêer.");
    }
    const projects = await db.project.findMany({ where: { schoolId: t.schoolId }, orderBy: [{ active: "desc" }, { year: "desc" }] });
    const created: string[] = [];
    for (const item of items) {
      const project = projects.find((p) => p.templateKey === item.templateKey);
      if (!project) return fout(`Daar is geen projek vir “${item.templateKey}” nie.`);
      const c = await db.pdfComparison.create({
        data: {
          schoolId: t.schoolId,
          teacherId: t.id,
          teacherName: t.name,
          projectId: project.id,
          templateKey: item.templateKey,
          fileName: item.name,
          status: "nagaan",
          model: "handmatig ingevoer",
          extracted: item.extracted as unknown as Prisma.InputJsonValue
        },
        select: { id: true }
      });
      created.push(c.id);
    }
    await logActivity(t, "pdf", `${created.length} uitgelese werkboek(e) ingevoer (JSON): ${items.map((i) => i.name).join(", ").slice(0, 600)}`, { link: "/onderwyser/pdf-vergelyking" });
    return NextResponse.json({ ids: created });
  });
}
