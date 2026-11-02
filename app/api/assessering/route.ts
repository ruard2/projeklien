import { NextResponse } from "next/server";
import { csvCell, type ScoreEntry } from "@/lib/assessering/diens";
import type { AssessmentResult } from "@/lib/assessering/ki";
import { rubricFor } from "@/lib/assessering/rubriek";
import { db } from "@/lib/db";
import { currentTeacher } from "@/lib/sessie";

export const dynamic = "force-dynamic";

/** Punte van een projek as CSV vir Excel: KI-voorstel en finale punte, met motivering. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = await currentTeacher();
  if (!t) return NextResponse.redirect(new URL(`/onderwyser/aanmeld?na=${encodeURIComponent(url.pathname + url.search)}`, url));
  const project = await db.project.findFirst({ where: { id: url.searchParams.get("projek") ?? "", schoolId: t.schoolId } });
  if (!project) return NextResponse.json({ error: "Projek nie gevind nie." }, { status: 404 });
  const rubric = rubricFor(project.templateKey);
  const groups = await db.group.findMany({
    where: { projectId: project.id, archived: false },
    orderBy: [{ klas: "asc" }, { name: "asc" }, { createdAt: "asc" }],
    select: {
      name: true,
      klas: true,
      code: true,
      members: true,
      rubricMarks: { where: { rubricKey: rubric.key } },
      rubricAssessments: { where: { rubricKey: rubric.key }, orderBy: { createdAt: "desc" }, take: 1, select: { result: true, aiTotal: true } }
    }
  });
  const ids = rubric.criteria.map((c) => c.id);
  const header = [
    "Klas",
    "Groep",
    "Kode",
    "Lede",
    ...rubric.criteria.map((c) => `KI K${c.number}`),
    "KI totaal /50",
    ...rubric.criteria.map((c) => `Finaal K${c.number}`),
    "Finaal totaal /50",
    "Status",
    "Beoordelaars",
    "Kommentaar",
    ...rubric.criteria.map((c) => `KI-motivering K${c.number}`),
    ...rubric.criteria.map((c) => `Onderwyser-nota K${c.number}`)
  ];
  const rows = groups.map((g) => {
    const mark = g.rubricMarks[0];
    const scores = (mark?.scores ?? {}) as Record<string, ScoreEntry>;
    const ai = g.rubricAssessments[0]?.result as unknown as AssessmentResult | undefined;
    const aiFor = (id: string) => ai?.kriteria.find((k) => k.id === id);
    return [
      g.klas,
      g.name ?? "",
      g.code,
      (Array.isArray(g.members) ? (g.members as string[]) : []).filter(Boolean).join(", "),
      ...ids.map((id) => aiFor(id)?.punt ?? ""),
      g.rubricAssessments[0]?.aiTotal ?? "",
      ...ids.map((id) => scores[id]?.punt ?? ""),
      mark?.total ?? "",
      mark?.status === "FINAAL" ? "Finaal" : mark ? "Konsep" : "",
      [mark?.teacherName, mark?.assessors].filter(Boolean).join(", "),
      mark?.comment ?? "",
      ...ids.map((id) => aiFor(id)?.motivering ?? ""),
      ...ids.map((id) => scores[id]?.nota ?? "")
    ];
  });
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vol-punte-graad${project.grade}-${new Date().toISOString().slice(0, 10)}.csv"` }
  });
}
