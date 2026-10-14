// Onderwysers se terugvoer aan die ontwikkelaar, verryk met konteks (die KI se oordeel en die
// groep se geanonimiseerde teks op daardie oomblik), sodat die KI-opdrag en kriteria bygestel kan word.

import { db } from "./db";
import { membersOf } from "./diens";
import type { FeedbackResult } from "./ki";
import { getSheet, getTemplate } from "./werkboeke/sjablone";
import { sheetToText } from "./werkboeke/teks";
import type { SheetData } from "./werkboeke/tipes";

export const RATING_LABEL: Record<string, string> = {
  reg: "Reg",
  te_streng: "Te streng",
  te_sag: "Te sag",
  verkeerd: "Verkeerd",
  fout: "Fout",
  voorstel: "Voorstel",
  vraag: "Vraag",
  ander: "Ander"
};

export type DevFeedbackRow = {
  id: string;
  datum: string;
  status: string;
  onderwyser: string;
  soort: string;
  oordeel: string;
  boodskap: string;
  projek: string;
  groep: string;
  groepkode: string;
  werkblad: string;
  kriterium: string;
  bladsy: string;
  ki_gereed: string;
  ki_opsomming: string;
  ki_kriteria: string;
  ki_oor_kriterium: string;
  groep_teks: string;
  ontwikkelaar_nota: string;
};

export async function devFeedbackRows(schoolId: string, opts: { status?: string; take?: number } = {}): Promise<DevFeedbackRow[]> {
  const items = await db.devFeedback.findMany({
    where: { schoolId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 2000
  });

  const groupIds = [...new Set(items.map((i) => i.groupId).filter((x): x is string => Boolean(x)))];
  const fbIds = [...new Set(items.map((i) => i.feedbackId).filter((x): x is string => Boolean(x)))];
  const [groups, feedbacks] = await Promise.all([
    db.group.findMany({ where: { id: { in: groupIds } }, include: { project: true } }),
    db.feedback.findMany({ where: { id: { in: fbIds } } })
  ]);

  const rows: DevFeedbackRow[] = [];
  for (const i of items) {
    const g = groups.find((x) => x.id === i.groupId);
    const fb = feedbacks.find((x) => x.id === i.feedbackId);
    const tpl = g ? getTemplate(g.project.templateKey) : null;
    const sheet = tpl && i.sheet ? getSheet(tpl, i.sheet) : null;
    const result = fb?.result as unknown as FeedbackResult | undefined;
    const crit = sheet?.criteria.find((c) => c.id === i.criterionId);

    // Die groep se werk soos dit was toe die KI dit beoordeel het (anders die huidige weergawe).
    let groepTeks = "";
    if (g && sheet && i.sheet) {
      const version = fb
        ? await db.responseVersion.findFirst({ where: { groupId: g.id, sheet: i.sheet, revision: fb.revision }, orderBy: { createdAt: "desc" } })
        : null;
      const data = version?.data ?? (await db.response.findUnique({ where: { groupId_sheet: { groupId: g.id, sheet: i.sheet } } }))?.data;
      if (data) groepTeks = sheetToText(sheet, data as SheetData, { members: membersOf(g), anonymise: true });
    }

    rows.push({
      id: i.id,
      datum: i.createdAt.toISOString().replace("T", " ").slice(0, 16),
      status: i.status,
      onderwyser: i.teacherName,
      soort: i.kind === "ki" ? "KI-terugvoer" : "Algemeen",
      oordeel: i.rating ? RATING_LABEL[i.rating] ?? i.rating : "",
      boodskap: i.message,
      projek: g ? `${g.project.title} ${g.project.year}` : "",
      groep: g ? g.name ?? "" : "",
      groepkode: g?.code ?? "",
      werkblad: sheet ? `${sheet.number ? `WB${sheet.number} ` : ""}${sheet.title}` : i.sheet ?? "",
      kriterium: crit ? crit.title : i.criterionId ?? "",
      bladsy: i.page ?? "",
      ki_gereed: fb ? (fb.ready ? "ja" : "nee") : "",
      ki_opsomming: result?.opsomming ?? "",
      ki_kriteria: result?.kriteria.map((k) => `${k.id}=${k.oordeel}`).join("; ") ?? "",
      ki_oor_kriterium: result?.kriteria.find((k) => k.id === i.criterionId)?.terugvoer ?? "",
      groep_teks: groepTeks,
      ontwikkelaar_nota: i.devNote ?? ""
    });
  }
  return rows;
}

/** CSV met ; as skeiding (Excel in Suid-Afrika/Nederland maak dit reg oop) en UTF-8 BOM. */
export function toCsv(rows: DevFeedbackRow[]): string {
  if (!rows.length) return "﻿geen terugvoer nie\n";
  const cols = Object.keys(rows[0]) as (keyof DevFeedbackRow)[];
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\r\n") + "\r\n";
}
