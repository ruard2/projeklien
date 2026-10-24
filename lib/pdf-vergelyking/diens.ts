// Werkvloei van die PDF-vergelyking: uitlees → onderwyser keur goed → KI-terugvoer
// per werkblad (presies soos in die app) → vergelyking met die onderwyser se kommentaar.

import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { DiensFout } from "../diens";
import { aiConfigured, generateFeedback, isReady, type FeedbackResult } from "../ki";
import { getTemplate } from "../werkboeke/sjablone";
import { rulesFor } from "../ki-reels";
import { sheetToText } from "../werkboeke/teks";
import type { Template } from "../werkboeke/tipes";
import { compareFeedback, extractPdf, type Vergelyking } from "./openai";
import { extractableSheets, jufText, membersFrom, normaliseExtraction, photoCountsFor, type Extracted } from "./skema";

export type SheetResult = {
  gereed?: boolean;
  source?: string;
  result?: FeedbackResult;
  vergelyking?: Vergelyking;
  fout?: string;
  herbeoordeel?: string;
  /** Uitslag van vóór ’n volledige herbeoordeling (vir voor/ná-vergelyking). */
  voorheen?: { ooreenkoms: string | null; gereed: boolean | null; oordele: Record<string, string>; at: string };
};
export type Results = Record<string, SheetResult>;

export const STALE_MS = 15 * 60_000;

export async function loadOwnComparison(id: string, teacher: { id: string; schoolId: string; role: string }) {
  const c = await db.pdfComparison.findFirst({
    where: { id, schoolId: teacher.schoolId, ...(teacher.role === "TEACHER" ? { teacherId: teacher.id } : {}) },
    include: { votes: true }
  });
  if (!c) throw new DiensFout("Vergelyking nie gevind nie.", 404);
  return c;
}

export function asExtracted(v: unknown): Extracted | null {
  return v && typeof v === "object" && "sheets" in (v as object) ? (v as Extracted) : null;
}

export function asResults(v: unknown): Results {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Results) : {};
}

// ---------------------------------------------------------------- 1. Uitlees

export async function runExtraction(id: string) {
  const c = await db.pdfComparison.findUnique({ where: { id } });
  if (!c?.pdf) return;
  try {
    if (!aiConfigured()) throw new Error("OPENAI_API_KEY is nie gestel nie.");
    const template = getTemplate(c.templateKey);
    const { raw, model } = await extractPdf(template, Buffer.from(c.pdf), c.fileName, c.model);
    const extracted = normaliseExtraction(template, raw);
    if (!Object.keys(extracted.sheets).length) throw new Error("Geen ingevulde werkblaaie in die PDF herken nie. Is dit die regte projek en ’n leesbare skandering?");
    await db.pdfComparison.update({
      where: { id },
      data: { status: "nagaan", error: null, model, extracted: extracted as unknown as Prisma.InputJsonValue, results: undefined }
    });
  } catch (e) {
    console.error("[pdf-vergelyking] uitlees", e);
    await db.pdfComparison.update({ where: { id }, data: { status: "fout", error: e instanceof Error ? e.message.slice(0, 500) : "Uitlees het misluk." } });
  }
}

// ---------------------------------------------------------------- 2. KI-terugvoer + vergelyking

function contextFor(template: Template, extracted: Extracted, members: string[], sheetKey: string) {
  const sheet = template.sheets.find((s) => s.key === sheetKey)!;
  return (sheet.context ?? [])
    .map((k) => {
      const cs = template.sheets.find((s) => s.key === k);
      const e = extracted.sheets[k];
      if (!cs || !e) return null;
      return { title: `Werkblad ${cs.number}: ${cs.title}`, text: sheetToText(cs, e.data, { members, anonymise: true, photoCounts: photoCountsFor(template, extracted, k) }) };
    })
    .filter((x): x is { title: string; text: string } => Boolean(x));
}


type Loaded = NonNullable<Awaited<ReturnType<typeof loadForFeedback>>>;

async function loadForFeedback(id: string) {
  const c = await db.pdfComparison.findUnique({ where: { id } });
  const extracted = asExtracted(c?.extracted);
  if (!c || !extracted) return null;
  const template = getTemplate(c.templateKey);
  const project = await db.project.findUnique({ where: { id: c.projectId } });
  return { c, extracted, template, project, members: membersFrom(extracted) };
}

/** Leerderteks van een werkblad soos die KI dit sien (geanonimiseer). */
export function anonymisedSheetText(l: Loaded, key: string): string {
  const sheet = l.template.sheets.find((s) => s.key === key)!;
  return sheetToText(sheet, l.extracted.sheets[key].data, { members: l.members, anonymise: true, photoCounts: photoCountsFor(l.template, l.extracted, key) });
}

async function feedbackForSheet(l: Loaded, key: string): Promise<SheetResult> {
  const { template, project, members, extracted } = l;
  const sheet = template.sheets.find((s) => s.key === key)!;
  const e = extracted.sheets[key];
  try {
    const out = await generateFeedback({
      template,
      sheet,
      project: {
        phenomenon: project?.phenomenon ?? template.defaults.phenomenon,
        question: project?.question ?? template.defaults.question,
        partner: project?.partner ?? template.defaults.partner,
        grade: project?.grade ?? template.grade
      },
      sheetText: anonymisedSheetText(l, key),
      contextTexts: contextFor(template, extracted, members, key),
      teacherRules: await rulesFor(l.c.schoolId, l.c.templateKey, key)
    });
    const r: SheetResult = { gereed: isReady(sheet, out.result), source: out.source, result: out.result };
    try {
      r.vergelyking = await compareFeedback({ sheet, jufText: jufText(e, members), ai: out.result });
    } catch (err) {
      console.error("[pdf-vergelyking] vergelyk", err);
    }
    return r;
  } catch (err) {
    console.error("[pdf-vergelyking] terugvoer", err);
    return { fout: err instanceof Error ? err.message.slice(0, 300) : "KI-terugvoer het misluk." };
  }
}

export async function runFeedback(id: string, previous?: Results) {
  const l = await loadForFeedback(id);
  if (!l) return;
  const results: Results = {};
  const stamp = new Date().toISOString();
  const withPrev = (key: string, r: SheetResult): SheetResult => {
    const p = previous?.[key];
    if (!p?.result) return r;
    return {
      ...r,
      herbeoordeel: stamp,
      voorheen: {
        ooreenkoms: p.vergelyking?.ooreenkoms ?? null,
        gereed: p.gereed ?? null,
        oordele: Object.fromEntries(p.result.kriteria.map((k) => [k.id, k.oordeel])),
        at: p.herbeoordeel ?? ""
      }
    };
  };
  const keys = extractableSheets(l.template).filter((s) => s.feedback && l.extracted.sheets[s.key]).map((s) => s.key);
  const save = () => db.pdfComparison.update({ where: { id }, data: { results: results as unknown as Prisma.InputJsonValue } });
  try {
    for (let i = 0; i < keys.length; i += 3) {
      await Promise.all(keys.slice(i, i + 3).map(async (key) => { results[key] = withPrev(key, await feedbackForSheet(l, key)); }));
      await save();
    }
    await db.pdfComparison.update({ where: { id }, data: { status: "klaar", error: null, results: results as unknown as Prisma.InputJsonValue } });
  } catch (e) {
    console.error("[pdf-vergelyking] ki", e);
    await db.pdfComparison.update({ where: { id }, data: { status: "fout", error: e instanceof Error ? e.message.slice(0, 500) : "KI-terugvoer het misluk." } });
  }
}

/** Beoordeel een werkblad weer (bv. nadat ’n onderwyser ’n reël bygevoeg het). */
export async function rerunSheet(id: string, key: string): Promise<SheetResult | null> {
  const l = await loadForFeedback(id);
  if (!l || !l.extracted.sheets[key]) return null;
  const r = await feedbackForSheet(l, key);
  const fresh = await db.pdfComparison.findUnique({ where: { id }, select: { results: true } });
  const results = { ...asResults(fresh?.results), [key]: { ...r, herbeoordeel: new Date().toISOString() } };
  await db.pdfComparison.update({ where: { id }, data: { results: results as unknown as Prisma.InputJsonValue } });
  return r;
}

export { loadForFeedback };

/** Beoordeel ’n hele vergelyking weer met die huidige reëls; die vorige uitslag word as “voorheen” bewaar. */
export async function rerunAll(id: string) {
  const c = await db.pdfComparison.findUnique({ where: { id }, select: { results: true } });
  const previous = asResults(c?.results);
  await db.pdfComparison.update({ where: { id }, data: { status: "ki", error: null } });
  await runFeedback(id, previous);
}

/** Voor/ná-opsomming oor een of meer vergelykings. */
export function beforeAfter(list: Results[]) {
  const voor: Record<string, number> = {};
  const na: Record<string, number> = {};
  let sheets = 0;
  let changed = 0;
  let criteria = 0;
  for (const results of list) {
    for (const r of Object.values(results)) {
      if (!r.voorheen || !r.result) continue;
      sheets++;
      const v = r.voorheen.ooreenkoms ?? "onbekend";
      const n = r.vergelyking?.ooreenkoms ?? "onbekend";
      voor[v] = (voor[v] ?? 0) + 1;
      na[n] = (na[n] ?? 0) + 1;
      for (const k of r.result.kriteria) {
        criteria++;
        if (r.voorheen.oordele[k.id] && r.voorheen.oordele[k.id] !== k.oordeel) changed++;
      }
    }
  }
  return { sheets, voor, na, changed, criteria };
}
