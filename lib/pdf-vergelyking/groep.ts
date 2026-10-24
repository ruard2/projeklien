// Van papierwerkboek na digitale werkboek: maak ’n regte groep uit ’n (nagegane)
// PDF-vergelyking, met die leerders se antwoorde as groepinvoer, die onderwyser se
// papierkommentaar per werkblad, kontrolepunte soos op papier afgeteken, en vars
// KI-terugvoer (met al die huidige reëls) wat die leerders kan lees.

import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { DiensFout } from "../diens";
import { dataHash } from "../hash";
import { AI_PROMPT_VERSION, generateFeedback, isReady } from "../ki";
import { snapshotFeedbackInput } from "../ki-invoer";
import { rulesFor } from "../ki-reels";
import { newGroupCode } from "../kodes";
import { getTemplate } from "../werkboeke/sjablone";
import { anonymisedSheetText, asExtracted, contextFor, loadForFeedback } from "./diens";
import { extractableSheets, jufText, membersFrom } from "./skema";
import { PAPER_NOTE, paperApprovedCheckpoints, paperGroupName, paperIdentity } from "./papier";

type Teacher = { id: string; name: string; schoolId: string };

/** Skep die groep en sy antwoorde. KI-terugvoer volg daarna (feedbackForPaperGroup). */
export async function createGroupFromComparison(comparisonId: string, teacher: Teacher) {
  const c = await db.pdfComparison.findFirst({ where: { id: comparisonId, schoolId: teacher.schoolId } });
  if (!c) throw new DiensFout("Vergelyking nie gevind nie.", 404);
  const e = asExtracted(c.extracted);
  if (!e) throw new DiensFout("Hierdie vergelyking is nog nie uitgelees nie.");
  if (c.groupId) {
    const existing = await db.group.findUnique({ where: { id: c.groupId }, include: { responses: { select: { id: true, data: true } } } });
    if (existing?.paperImport) throw new DiensFout("Daar is reeds ’n digitale werkboek vir hierdie groep gemaak.");
    if (existing?.responses.some((r) => r.data && Object.keys(r.data as object).length)) {
      throw new DiensFout("Die gekoppelde groep het reeds werk in die app. Ontkoppel eers, of skep ’n nuwe groep.");
    }
  }
  const siblings = await db.pdfComparison.findMany({
    where: { schoolId: teacher.schoolId, templateKey: c.templateKey, id: { not: c.id }, groupId: { not: null } },
    select: { groupId: true, extracted: true }
  });
  const me = paperIdentity(c.templateKey, e);
  const twin = siblings.find((x) => asExtracted(x.extracted) && paperIdentity(c.templateKey, asExtracted(x.extracted)!) === me);
  if (twin?.groupId && (await db.group.count({ where: { id: twin.groupId, paperImport: true } }))) {
    throw new DiensFout("Hierdie groep het reeds ’n digitale werkboek (uit ’n ander oplaai van dieselfde werkboek).");
  }
  const project = await db.project.findFirst({ where: { id: c.projectId, schoolId: teacher.schoolId } });
  if (!project) throw new DiensFout("Projek nie gevind nie.");
  const template = getTemplate(c.templateKey);
  const members = [0, 1, 2, 3].map((i) => (e.lede[i] ?? "").trim().slice(0, 60));
  const name = paperGroupName(e);
  const klas = e.klas.trim().slice(0, 20) || null;
  const approved = paperApprovedCheckpoints(c.templateKey, e);
  const now = new Date();

  let group = null;
  for (let tries = 0; tries < 5 && !group; tries++) {
    try {
      group = await db.group.create({ data: { projectId: project.id, code: newGroupCode(project.grade), name, klas, members, paperImport: true } });
    } catch {
      /* kode bestaan reeds */
    }
  }
  if (!group) throw new DiensFout("Kon nie ’n groepkode maak nie. Probeer weer.");

  const cover = { groepnaam: name, klas: klas ?? "", lid1: members[0], lid2: members[1], lid3: members[2], lid4: members[3] };
  const rows: Prisma.ResponseCreateManyInput[] = [
    { groupId: group.id, sheet: "voorblad", data: cover, revision: 1, status: "IN_PROGRESS" }
  ];
  for (const s of extractableSheets(template)) {
    const x = e.sheets[s.key];
    if (!x) continue;
    const juf = jufText(x, membersFrom(e)).trim();
    rows.push({
      groupId: group.id,
      sheet: s.key,
      data: x.data as Prisma.InputJsonValue,
      revision: 1,
      status: "IN_PROGRESS",
      teacherNotes: juf ? { [PAPER_NOTE]: { text: juf, by: "Onderwyser (papier)", at: now.toISOString() } } : {}
    });
  }
  await db.response.createMany({ data: rows });
  await db.responseVersion.createMany({
    data: rows.map((r) => ({ groupId: group.id, sheet: r.sheet, revision: 1, data: r.data as Prisma.InputJsonValue, reason: "papier" }))
  });
  for (const n of approved) {
    await db.checkpoint.create({
      data: {
        groupId: group.id,
        number: n,
        status: "APPROVED",
        submittedAt: now,
        decidedAt: now,
        teacherId: teacher.id,
        teacherName: "Papierwerkboek",
        comment: "Op papier afgeteken.",
        history: [{ action: "papier", by: teacher.name, at: now.toISOString() }]
      }
    });
  }
  await db.pdfComparison.update({ where: { id: c.id }, data: { groupId: group.id } });
  return { group, approved };
}

/** Vars KI-terugvoer per werkblad, presies soos die app dit maak, en gestoor as die groep se terugvoer. */
export async function feedbackForPaperGroup(comparisonId: string, groupId: string) {
  const l = await loadForFeedback(comparisonId);
  if (!l) return;
  const keys = extractableSheets(l.template).filter((s) => s.feedback && l.extracted.sheets[s.key]).map((s) => s.key);
  const responses = await db.response.findMany({ where: { groupId } });
  const one = async (key: string) => {
    const sheet = l.template.sheets.find((s) => s.key === key)!;
    const r = responses.find((x) => x.sheet === key);
    if (!r) return;
    try {
      const input = {
        template: l.template,
        sheet,
        project: {
          phenomenon: l.project?.phenomenon ?? l.template.defaults.phenomenon,
          question: l.project?.question ?? l.template.defaults.question,
          partner: l.project?.partner ?? l.template.defaults.partner,
          grade: l.project?.grade ?? l.template.grade
        },
        sheetText: anonymisedSheetText(l, key),
        contextTexts: contextFor(l.template, l.extracted, l.members, key),
        teacherRules: await rulesFor(l.c.schoolId, l.c.templateKey, key)
      };
      const out = await generateFeedback(input);
      const ready = isReady(sheet, out.result);
      await db.feedback.create({
        data: {
          groupId,
          sheet: key,
          revision: r.revision,
          ready,
          result: out.result as unknown as Prisma.InputJsonValue,
          source: out.source,
          promptVer: AI_PROMPT_VERSION,
          sheetVer: l.template.version,
          inputSnapshot: snapshotFeedbackInput(input, key) as unknown as Prisma.InputJsonValue
        }
      });
      await db.response.updateMany({
        where: { id: r.id, revision: r.revision },
        data: ready ? { status: "READY", readyHash: dataHash(r.data), readyBy: "KI" } : { status: "NOT_READY", readyHash: null, readyBy: null }
      });
    } catch (err) {
      console.error("[papiergroep] terugvoer", key, err);
    }
  };
  for (let i = 0; i < keys.length; i += 3) await Promise.all(keys.slice(i, i + 3).map(one));
}
