// Volledige uitvoer vir ontleding (net administrateurs): KI-reëls met geskiedenis, duimpies en
// gesprekke met die KI-oordeel waaroor dit gaan, vergelykings (geanonimiseer) en die ouditlog.
// Leerdername word nie uitgevoer nie: werk en juf-kommentaar is deur die anonimisering.

import { NextResponse } from "next/server";
import { fout, handle } from "@/lib/api";
import { db } from "@/lib/db";
import { asExtracted, asResults } from "@/lib/pdf-vergelyking/diens";
import { jufText, membersFrom, photoCountsFor } from "@/lib/pdf-vergelyking/skema";
import { currentTeacher, isAdminRole } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";
import { sheetToText } from "@/lib/werkboeke/teks";

export async function GET() {
  return handle(async () => {
    const t = await currentTeacher();
    if (!t) return new Response(null, { status: 302, headers: { Location: "/onderwyser/aanmeld?na=/api/oudit/uitvoer" } });
    if (!isAdminRole(t.role)) return fout("Net administrateurs.", 403);
    const schoolId = t.schoolId;

    const [teachers, rules, votes, comparisons, activity] = await Promise.all([
      db.teacher.findMany({ where: { schoolId }, select: { id: true, name: true, role: true, active: true, lastLoginAt: true } }),
      db.aiRule.findMany({ where: { schoolId }, orderBy: { createdAt: "asc" }, include: { events: { orderBy: { at: "asc" } } } }),
      db.pdfVote.findMany({ where: { comparison: { schoolId } }, orderBy: { updatedAt: "asc" } }),
      db.pdfComparison.findMany({ where: { schoolId }, orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true, teacherName: true, templateKey: true, fileName: true, status: true, model: true, extracted: true, results: true } }),
      db.teacherActivity.findMany({ where: { schoolId }, orderBy: { at: "asc" }, take: 20000 })
    ]);

    const label = (templateKey: string, sheet: string | null, criterionId: string | null) => {
      if (templateKey === "*") return { werkboek: "Alle werkboeke (gees)", werkblad: null, kriterium: null };
      try {
        const tpl = getTemplate(templateKey);
        const s = sheet ? tpl.sheets.find((x) => x.key === sheet) : null;
        const c = criterionId ? s?.criteria.find((x) => x.id === criterionId) : null;
        return { werkboek: tpl.label, werkblad: s ? `WB${s.number} ${s.title}` : null, kriterium: c ? `${c.title}: ${c.description}` : null };
      } catch {
        return { werkboek: templateKey, werkblad: sheet, kriterium: criterionId };
      }
    };

    const cmpById = new Map(comparisons.map((c) => [c.id, c]));
    const uitvoer = {
      uitgevoer: new Date().toISOString(),
      deur: t.name,
      onderwysers: teachers,
      reels: rules.map((r) => ({
        id: r.id,
        ...label(r.templateKey, r.sheet, r.criterionId),
        templateKey: r.templateKey,
        sheet: r.sheet,
        criterionId: r.criterionId,
        teks: r.text,
        aktief: r.active,
        geskrap: r.deletedAt,
        skrywer: r.createdByName,
        aangemaak: r.createdAt,
        bronVergelyking: r.sourceComparisonId,
        geskiedenis: r.events.map((e) => ({ at: e.at, deur: e.byName, handeling: e.action, ou: e.oldText, nuut: e.newText, nota: e.note, nagegaan: e.reviewedAt ? `${e.reviewedByName} ${e.reviewedAt.toISOString()}` : null }))
      })),
      duimpies: votes.map((v) => {
        const c = cmpById.get(v.comparisonId);
        const res = c ? asResults(c.results)[v.sheet] : undefined;
        const verdict = res?.result?.kriteria.find((k) => k.id === v.criterionId);
        return {
          vergelyking: v.comparisonId,
          onderwyser: teachers.find((x) => x.id === v.teacherId)?.name ?? v.teacherId,
          ...(c ? label(c.templateKey, v.sheet, v.criterionId) : {}),
          duim: v.vote === 1 ? "op" : "af",
          kiOordeel: verdict?.oordeel ?? null,
          kiTerugvoer: verdict?.terugvoer ?? null,
          rede: v.reason,
          gesprek: v.chat,
          reelId: v.ruleId,
          at: v.updatedAt
        };
      }),
      vergelykings: comparisons.map((c) => {
        const e = asExtracted(c.extracted);
        const results = asResults(c.results);
        let tpl = null;
        try {
          tpl = getTemplate(c.templateKey);
        } catch {
          tpl = null;
        }
        const members = e ? membersFrom(e) : [];
        return {
          id: c.id,
          at: c.createdAt,
          onderwyser: c.teacherName,
          werkboek: tpl?.label ?? c.templateKey,
          status: c.status,
          model: c.model,
          werkblaaie: e && tpl
            ? Object.keys(e.sheets).map((key) => {
                const s = tpl!.sheets.find((x) => x.key === key);
                const r = results[key];
                return {
                  werkblad: s ? `WB${s.number} ${s.title}` : key,
                  leerders: s ? sheetToText(s, e.sheets[key].data, { members, anonymise: true, photoCounts: photoCountsFor(tpl!, e, key) }) : null,
                  juf: jufText(e.sheets[key], members),
                  jufVorigeWeergawe: e.sheets[key].juf.kommentaar_vorige,
                  ki: r?.result ?? null,
                  kiGereed: r?.gereed ?? null,
                  vergelyking: r?.vergelyking ?? null,
                  herbeoordeel: r?.herbeoordeel ?? null
                };
              })
            : []
        };
      }),
      aktiwiteit: activity.map((a) => ({ at: a.at, onderwyser: a.teacherName, tipe: a.type, wat: a.summary, besonderhede: a.details }))
    };

    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    return new NextResponse(JSON.stringify(uitvoer, null, 1), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ki-oudit-${stamp}.json"`,
        "Cache-Control": "no-store"
      }
    });
  });
}
