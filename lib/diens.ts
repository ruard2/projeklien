// Besigheidslogika vir werkboeke: stoor, terugvoer, indien en aftekening.
// Alle reëls oor wat wanneer mag gebeur, word hier (bediener-kant) afgedwing.

import type { Checkpoint, Group, Prisma, Response } from "@prisma/client";
import { db } from "./db";
import { dataHash } from "./hash";
import { AI_PROMPT_VERSION, generateFeedback, isReady, type FeedbackResult } from "./ki";
import { buildFeedbackInput, snapshotFeedbackInput } from "./ki-invoer";
import { getSheet, getTemplate } from "./werkboeke/sjablone";
import { canSubmit, sheetAccess, type CheckpointState } from "./werkboeke/toegang";
import type { Sheet, SheetData, Template } from "./werkboeke/tipes";
import { missingFields } from "./werkboeke/volledigheid";

export class DiensFout extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "fout"
  ) {
    super(message);
  }
}

const VERSION_INTERVAL_MS = 10 * 60 * 1000;
const MAX_DATA_BYTES = 200_000;

export function membersOf(group: Pick<Group, "members">): string[] {
  const m = Array.isArray(group.members) ? (group.members as unknown[]) : [];
  return [0, 1, 2, 3].map((i) => (typeof m[i] === "string" ? (m[i] as string) : ""));
}

export async function loadWorkbook(groupId: string) {
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { project: { include: { school: true } }, responses: true, checkpoints: true }
  });
  if (!group) throw new DiensFout("Groep nie gevind nie.", 404);
  const template = getTemplate(group.project.templateKey);
  return { group, template, members: membersOf(group) };
}

export function cpStates(cps: Pick<Checkpoint, "number" | "status">[]): CheckpointState[] {
  return cps.map((c) => ({ number: c.number, status: c.status }));
}

function resolveSheet(template: Template, sheetKey: string): Sheet {
  const sheet = getSheet(template, sheetKey);
  if (!sheet) throw new DiensFout("Onbekende werkblad.", 404);
  return sheet;
}

function asData(v: unknown): SheetData {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as SheetData) : {};
}

/** Haal ’n werkblad + toegang, sonder om iets te skep. */
export async function getSheetState(groupId: string, sheetKey: string) {
  const { group, template, members } = await loadWorkbook(groupId);
  const sheet = resolveSheet(template, sheetKey);
  const access = sheetAccess(sheet, cpStates(group.checkpoints));
  const response = group.responses.find((r) => r.sheet === sheetKey) ?? null;
  return { group, template, members, sheet, access, response };
}

// ---------------------------------------------------------------- Stoor

export async function saveSheet(groupId: string, sheetKey: string, data: unknown, baseRevision: number) {
  const { group, sheet, access, response } = await getSheetState(groupId, sheetKey);
  if (!access.editable) throw new DiensFout(access.reason ?? "Hierdie werkblad is gesluit.", 423, "gesluit");
  const clean = asData(data);
  if (JSON.stringify(clean).length > MAX_DATA_BYTES) throw new DiensFout("Te veel teks op een werkblad.", 413);

  const hash = dataHash(clean);
  const current = response;
  if (current && current.revision !== baseRevision) {
    throw new DiensFout("Iemand anders in julle groep het intussen hierdie werkblad verander.", 409, "konflik");
  }

  let status = current?.status ?? "NOT_STARTED";
  if (status === "NOT_STARTED") status = "IN_PROGRESS";
  // Verander die werk ná "gereed", moet daar weer terugvoer gevra word.
  if (status === "READY" && current?.readyHash !== hash) status = "NOT_READY";

  const nextRevision = (current?.revision ?? 0) + 1;
  let saved: Response;
  if (current) {
    const res = await db.response.updateMany({
      where: { id: current.id, revision: baseRevision },
      data: { data: clean as Prisma.InputJsonValue, revision: nextRevision, status }
    });
    if (res.count === 0) throw new DiensFout("Iemand anders in julle groep het intussen hierdie werkblad verander.", 409, "konflik");
    saved = (await db.response.findUnique({ where: { id: current.id } }))!;
  } else {
    if (baseRevision !== 0) throw new DiensFout("Werkblad bestaan nie meer nie.", 409, "konflik");
    try {
      saved = await db.response.create({
        data: { groupId, sheet: sheetKey, data: clean as Prisma.InputJsonValue, revision: 1, status }
      });
    } catch {
      throw new DiensFout("Iemand anders in julle groep het intussen hierdie werkblad begin.", 409, "konflik");
    }
  }

  // Weergawegeskiedenis: hoogstens elke 10 minute ’n outomatiese momentopname.
  const last = await db.responseVersion.findFirst({ where: { groupId, sheet: sheetKey }, orderBy: { createdAt: "desc" } });
  if (!last || Date.now() - last.createdAt.getTime() > VERSION_INTERVAL_MS) {
    await snapshot(groupId, sheetKey, saved.revision, clean, "outostoor");
  }

  if (sheet.key === "voorblad") await syncCover(group.id, clean);

  return { revision: saved.revision, status: saved.status, updatedAt: saved.updatedAt };
}

async function syncCover(groupId: string, data: SheetData) {
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string).trim().slice(0, 60) : "");
  await db.group.update({
    where: { id: groupId },
    data: { name: s("groepnaam") || null, klas: s("klas") || null, members: [s("lid1"), s("lid2"), s("lid3"), s("lid4")] }
  });
}

async function snapshot(groupId: string, sheet: string, revision: number, data: unknown, reason: string) {
  await db.responseVersion.create({ data: { groupId, sheet, revision, data: data as Prisma.InputJsonValue, reason } });
}

// ---------------------------------------------------------------- Terugvoer

export async function requestFeedback(groupId: string, sheetKey: string) {
  const state = await getSheetState(groupId, sheetKey);
  const { template, sheet, access } = state;
  if (!sheet.feedback) throw new DiensFout("Hierdie bladsy het nie terugvoer nie.");
  if (!access.editable) throw new DiensFout(access.reason ?? "Hierdie werkblad is gesluit.", 423, "gesluit");
  const response =
    state.response ??
    (await db.response.upsert({
      where: { groupId_sheet: { groupId, sheet: sheetKey } },
      create: { groupId, sheet: sheetKey, status: "IN_PROGRESS" },
      update: {}
    }));

  const data = asData(response.data);
  const hash = dataHash(data);
  const missing = missingFields(sheet, data);

  let result: FeedbackResult;
  let source: string;
  let inputSnapshot: Prisma.InputJsonValue | undefined;
  if (missing.length) {
    source = "volledigheid";
    result = {
      opsomming: "Julle is goed op pad! Vul eers die volgende dele volledig in, dan kan julle weer terugvoer vra.",
      kriteria: [],
      sterkpunte: [],
      vrae: [],
      reelkwessies: [],
      ontbrekend: missing
    };
  } else {
    const input = await buildFeedbackInput(groupId, sheetKey, response.revision);
    inputSnapshot = snapshotFeedbackInput(input, sheetKey) as unknown as Prisma.InputJsonValue;
    const out = await generateFeedback(input);
    result = out.result;
    source = out.source;
  }

  const ready = isReady(sheet, result);
  const feedback = await db.feedback.create({
    data: {
      groupId,
      sheet: sheetKey,
      revision: response.revision,
      ready,
      result: result as unknown as Prisma.InputJsonValue,
      source,
      promptVer: AI_PROMPT_VERSION,
      sheetVer: template.version,
      inputSnapshot
    }
  });

  // Die status geld net vir die presiese weergawe wat beoordeel is.
  await db.response.updateMany({
    where: { id: response.id, revision: response.revision },
    data: ready ? { status: "READY", readyHash: hash, readyBy: "KI" } : { status: "NOT_READY", readyHash: null, readyBy: null }
  });
  await snapshot(groupId, sheetKey, response.revision, data, "terugvoer");

  return { feedback, ready };
}

// ---------------------------------------------------------------- Kontrolepunte

export function sheetStatesFor(template: Template, responses: Response[]) {
  return template.sheets
    .filter((s) => !s.perMember)
    .map((s) => {
      const r = responses.find((x) => x.sheet === s.key);
      return {
        sheet: s.key,
        status: r?.status ?? ("NOT_STARTED" as const),
        readyHash: r?.readyHash ?? null,
        currentHash: dataHash(asData(r?.data))
      };
    });
}

function pushHistory(cp: Checkpoint | null, entry: Record<string, unknown>): Prisma.InputJsonValue {
  const prev = Array.isArray(cp?.history) ? (cp!.history as Prisma.JsonArray) : [];
  return [...prev, { ...entry, at: new Date().toISOString() }] as Prisma.InputJsonValue;
}

export async function submitCheckpoint(groupId: string, n: number) {
  const { group, template } = await loadWorkbook(groupId);
  const check = canSubmit(template, n, cpStates(group.checkpoints), sheetStatesFor(template, group.responses));
  if (!check.ok) throw new DiensFout(check.reason ?? "Kan nog nie indien nie.");
  const existing = group.checkpoints.find((c) => c.number === n) ?? null;
  await db.checkpoint.upsert({
    where: { groupId_number: { groupId, number: n } },
    create: { groupId, number: n, status: "SUBMITTED", submittedAt: new Date(), history: pushHistory(null, { action: "ingedien" }) },
    update: { status: "SUBMITTED", submittedAt: new Date(), history: pushHistory(existing, { action: "ingedien" }) }
  });
  const def = template.checkpoints.find((c) => c.number === n)!;
  for (const key of def.sheets) {
    const r = group.responses.find((x) => x.sheet === key);
    if (r) await snapshot(groupId, key, r.revision, r.data, "ingedien");
  }
}

export async function decideCheckpoint(
  teacher: { id: string; name: string },
  groupId: string,
  n: number,
  decision: "APPROVED" | "RETURNED",
  comment: string
) {
  const { group } = await loadWorkbook(groupId);
  const cp = group.checkpoints.find((c) => c.number === n) ?? null;
  if (decision === "APPROVED" && cp?.status !== "SUBMITTED") throw new DiensFout("Slegs ingediende kontrolepunte kan afgeteken word.");
  if (decision === "RETURNED" && !comment.trim()) throw new DiensFout("Skryf asseblief vir die groep wat nog aandag nodig het.");
  const action = decision === "APPROVED" ? "afgeteken" : "teruggestuur";
  await db.checkpoint.upsert({
    where: { groupId_number: { groupId, number: n } },
    create: { groupId, number: n, status: decision, decidedAt: new Date(), teacherId: teacher.id, teacherName: teacher.name, comment, history: pushHistory(null, { action, by: teacher.name, comment }) },
    update: { status: decision, decidedAt: new Date(), teacherId: teacher.id, teacherName: teacher.name, comment, history: pushHistory(cp, { action, by: teacher.name, comment }) }
  });
}

/** Onderwyser maak ’n afgetekende of ingediende kontrolepunt weer oop. */
export async function reopenCheckpoint(teacher: { id: string; name: string }, groupId: string, n: number, comment: string) {
  const { group } = await loadWorkbook(groupId);
  const later = group.checkpoints.find((c) => c.number > n && (c.status === "SUBMITTED" || c.status === "APPROVED"));
  if (later) throw new DiensFout(`Kontrolepunt ${later.number} is reeds ingedien of afgeteken. Maak eers daardie een oop.`);
  const cp = group.checkpoints.find((c) => c.number === n) ?? null;
  if (!cp) throw new DiensFout("Hierdie kontrolepunt is nog oop.");
  await db.checkpoint.update({
    where: { id: cp.id },
    data: { status: "RETURNED", decidedAt: new Date(), teacherId: teacher.id, teacherName: teacher.name, comment, history: pushHistory(cp, { action: "heropen", by: teacher.name, comment }) }
  });
}

/** Die KI kan foute maak: die onderwyser kan ’n werkblad self gereed verklaar. */
export async function teacherMarkReady(teacher: { name: string }, groupId: string, sheetKey: string) {
  const { sheet, response } = await getSheetState(groupId, sheetKey);
  if (!response) throw new DiensFout("Die groep het nog niks op hierdie werkblad nie.");
  if (sheet.checkpoint === null) throw new DiensFout("Hierdie bladsy het nie ’n kontrolepunt nie.");
  await db.response.update({
    where: { id: response.id },
    data: { status: "READY", readyHash: dataHash(asData(response.data)), readyBy: teacher.name }
  });
}

export async function saveTeacherNote(teacher: { name: string }, groupId: string, sheetKey: string, field: string, text: string) {
  const { sheet, response } = await getSheetState(groupId, sheetKey);
  const f = sheet.sections.flatMap((s) => s.fields).find((x) => x.key === field && x.type === "teacherNote");
  if (!f) throw new DiensFout("Onbekende veld.");
  const notes = { ...((response?.teacherNotes as Record<string, unknown>) ?? {}), [field]: { text: text.slice(0, 4000), by: teacher.name, at: new Date().toISOString() } };
  await db.response.upsert({
    where: { groupId_sheet: { groupId, sheet: sheetKey } },
    create: { groupId, sheet: sheetKey, teacherNotes: notes as Prisma.InputJsonValue },
    update: { teacherNotes: notes as Prisma.InputJsonValue }
  });
}
