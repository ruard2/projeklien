// Rubriekassessering: KI-voorstelle bewaar en onderwysers se finale punte stoor.
// Slegs onderwysers kom hier; niks hiervan is vir leerdergroepe sigbaar nie.

import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { DiensFout, loadWorkbook } from "../diens";
import { dataHash } from "../hash";
import { ASSESS_PROMPT_VERSION, ASSESSED_SHEETS, assessWorkbook, buildEvidence, hasWork, type AssessmentResult, type EvidenceInput } from "./ki";
import { isValidScore, rubricFor, totalOf, type Rubric } from "./rubriek";

export type ScoreEntry = { punt: number; nota?: string };
export type MarkHistory = { at: string; by: string; action: string; total: number; scores: Record<string, number> };

/** Vingerafdruk van werkblad 1–14: wys of die werkboek ná die KI-beoordeling verander het. */
export function workbookHash(responses: { sheet: string; data: unknown }[]): string {
  const byKey = Object.fromEntries(ASSESSED_SHEETS.map((k) => [k, responses.find((r) => r.sheet === k)?.data ?? {}]));
  return dataHash(byKey);
}

async function evidenceInputFor(groupId: string): Promise<{ input: EvidenceInput; rubric: Rubric; schoolId: string }> {
  const { group, template, members } = await loadWorkbook(groupId);
  const photos = await db.photo.findMany({ where: { groupId }, select: { sheet: true, field: true, caption: true } });
  return {
    rubric: rubricFor(template.key),
    schoolId: group.project.schoolId,
    input: {
      template,
      project: { phenomenon: group.project.phenomenon, question: group.project.question, partner: group.project.partner, grade: group.project.grade },
      responses: group.responses.map((r) => ({ sheet: r.sheet, data: r.data, teacherNotes: r.teacherNotes, createdAt: r.createdAt, updatedAt: r.updatedAt })),
      members,
      photos,
      checkpoints: group.checkpoints.map((c) => ({ number: c.number, status: c.status })),
      paperImport: group.paperImport
    }
  };
}

export type RunOutcome = { status: "klaar" | "reeds" | "leeg"; total?: number };

/** Laat die KI een groep beoordeel. Sonder `force` word ’n onveranderde werkboek nie weer betaal nie. */
export async function runAssessment(schoolId: string, groupId: string, by: string, force = false): Promise<RunOutcome> {
  const { input, rubric, schoolId: groupSchool } = await evidenceInputFor(groupId);
  if (groupSchool !== schoolId) throw new DiensFout("Groep nie gevind nie.", 404);
  if (!hasWork(input)) return { status: "leeg" };

  const hash = workbookHash(input.responses);
  if (!force) {
    const existing = await db.rubricAssessment.findFirst({
      where: { groupId, rubricKey: rubric.key, rubricVersion: rubric.version, workbookHash: hash },
      orderBy: { createdAt: "desc" },
      select: { aiTotal: true, source: true }
    });
    if (existing && existing.source !== "toetsmodus") return { status: "reeds", total: existing.aiTotal };
  }

  const evidence = buildEvidence(input);
  const { result, source } = await assessWorkbook(rubric, input, evidence);
  await db.rubricAssessment.create({
    data: {
      groupId,
      rubricKey: rubric.key,
      rubricVersion: rubric.version,
      workbookHash: hash,
      source,
      promptVer: ASSESS_PROMPT_VERSION,
      aiTotal: result.totaal,
      result: result as unknown as Prisma.InputJsonValue,
      inputText: evidence,
      createdBy: by
    }
  });
  return { status: "klaar", total: result.totaal };
}

export function parseScores(rubric: Rubric, raw: Record<string, unknown>): Record<string, ScoreEntry> {
  const out: Record<string, ScoreEntry> = {};
  for (const c of rubric.criteria) {
    const text = String(raw[`punt_${c.id}`] ?? "").trim();
    const punt = /^\d{1,2}$/.test(text) ? Number(text) : NaN;
    if (!isValidScore(punt, c.max)) throw new DiensFout(`Gee ’n heel punt van 0 tot ${c.max} by kriterium ${c.number}.`);
    const nota = String(raw[`nota_${c.id}`] ?? "").trim().slice(0, 2000);
    out[c.id] = nota ? { punt, nota } : { punt };
  }
  return out;
}

/** Stoor die onderwysers se punte. Die totaal word hier bereken en elke verandering word bewaar. */
export async function saveMark(
  teacher: { id: string; name: string; schoolId: string },
  groupId: string,
  values: { scores: Record<string, unknown>; comment: string; assessors: string; assessmentId: string | null; finalise: boolean }
) {
  const { group, template } = await loadWorkbook(groupId);
  if (group.project.schoolId !== teacher.schoolId) throw new DiensFout("Groep nie gevind nie.", 404);
  const rubric = rubricFor(template.key);
  const scores = parseScores(rubric, values.scores);
  const flat = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.punt]));
  const total = totalOf(flat, rubric);
  const status = values.finalise ? "FINAAL" : "KONSEP";
  let assessmentId = values.assessmentId;
  if (assessmentId) {
    const own = await db.rubricAssessment.findFirst({ where: { id: assessmentId, groupId }, select: { id: true } });
    assessmentId = own?.id ?? null;
  }
  const existing = await db.rubricMark.findUnique({ where: { groupId_rubricKey: { groupId, rubricKey: rubric.key } } });
  const entry: MarkHistory = { at: new Date().toISOString(), by: teacher.name, action: values.finalise ? "gefinaliseer" : "gestoor", total, scores: flat };
  const history = [...(Array.isArray(existing?.history) ? (existing!.history as unknown as MarkHistory[]) : []), entry];
  const data = {
    status,
    scores: scores as unknown as Prisma.InputJsonValue,
    total,
    comment: values.comment.trim().slice(0, 4000) || null,
    assessors: values.assessors.trim().slice(0, 200) || null,
    assessmentId,
    teacherId: teacher.id,
    teacherName: teacher.name,
    finalisedAt: values.finalise ? new Date() : null,
    history: history as unknown as Prisma.InputJsonValue
  };
  await db.rubricMark.upsert({
    where: { groupId_rubricKey: { groupId, rubricKey: rubric.key } },
    create: { groupId, rubricKey: rubric.key, ...data },
    update: data
  });
  return { total, status, groupName: group.name ?? group.code };
}

export type { AssessmentResult };

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Leerdersteks mag nie as ’n formule in Excel uitgevoer word nie.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
