import { db } from "./db";
import { membersOf } from "./diens";
import type { FeedbackResult } from "./ki";
import { AI_REPORT_LABELS } from "./terugvoer-beheer";
import { getSheet, getTemplate } from "./werkboeke/sjablone";
import { sheetToText } from "./werkboeke/teks";
import type { SheetData } from "./werkboeke/tipes";

export async function aiReportRows(schoolId: string) {
  const reports = await db.aiReport.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" } });
  const groups = await db.group.findMany({
    where: { id: { in: [...new Set(reports.map((report) => report.groupId))] } },
    include: { project: true }
  });
  const feedbacks = await db.feedback.findMany({ where: { id: { in: [...new Set(reports.map((report) => report.feedbackId))] } } });

  return Promise.all(reports.map(async (report) => {
    const group = groups.find((item) => item.id === report.groupId);
    const feedback = feedbacks.find((item) => item.id === report.feedbackId);
    const template = group ? getTemplate(group.project.templateKey) : null;
    const sheet = template ? getSheet(template, report.sheet) : null;
    const version = feedback
      ? await db.responseVersion.findFirst({ where: { groupId: report.groupId, sheet: report.sheet, revision: feedback.revision }, orderBy: { createdAt: "desc" } })
      : null;
    const data = version?.data ?? (await db.response.findUnique({ where: { groupId_sheet: { groupId: report.groupId, sheet: report.sheet } } }))?.data;
    const result = feedback?.result as unknown as FeedbackResult | undefined;
    return {
      id: report.id,
      datum: report.createdAt.toISOString(),
      status: report.status,
      kategorie: AI_REPORT_LABELS[report.category as keyof typeof AI_REPORT_LABELS] ?? report.category,
      boodskap: report.message,
      projek: group ? `${group.project.title} ${group.project.year}` : "",
      groepkode: group?.code ?? "",
      werkblad: sheet ? `WB${sheet.number ?? ""} ${sheet.title}`.trim() : report.sheet,
      ki_model: feedback?.source ?? "",
      ki_opdragweergawe: feedback?.promptVer ?? "",
      werkboekweergawe: feedback ? String(feedback.sheetVer) : "",
      ki_opsomming: result?.opsomming ?? "",
      ki_kriteria: result?.kriteria.map((item) => `${item.id}=${item.oordeel}`).join("; ") ?? "",
      groep_teks: group && sheet && data ? sheetToText(sheet, data as SheetData, { members: membersOf(group), anonymise: true }) : "",
      interne_nota: report.devNote ?? "",
      oplossing: report.resolution ?? ""
    };
  }));
}

export function reportRowsToCsv(rows: Awaited<ReturnType<typeof aiReportRows>>): string {
  if (!rows.length) return "﻿geen KI-verslae nie\n";
  const cols = Object.keys(rows[0]) as (keyof (typeof rows)[number])[];
  const esc = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [cols.join(";"), ...rows.map((row) => cols.map((col) => esc(row[col])).join(";"))].join("\r\n") + "\r\n";
}
