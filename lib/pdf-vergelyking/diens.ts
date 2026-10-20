// Werkvloei van die PDF-vergelyking: uitlees → onderwyser keur goed → KI-terugvoer
// per werkblad (presies soos in die app) → vergelyking met die onderwyser se kommentaar.

import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { DiensFout } from "../diens";
import { aiConfigured, generateFeedback, isReady, type FeedbackResult } from "../ki";
import { getTemplate } from "../werkboeke/sjablone";
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


export async function runFeedback(id: string) {
  const c = await db.pdfComparison.findUnique({ where: { id }, include: { school: true } });
  const extracted = asExtracted(c?.extracted);
  if (!c || !extracted) return;
  const template = getTemplate(c.templateKey);
  const project = await db.project.findUnique({ where: { id: c.projectId } });
  const members = membersFrom(extracted);
  const results: Results = {};
  const keys = extractableSheets(template).filter((s) => s.feedback && extracted.sheets[s.key]).map((s) => s.key);

  const save = () => db.pdfComparison.update({ where: { id }, data: { results: results as unknown as Prisma.InputJsonValue } });

  try {
    for (let i = 0; i < keys.length; i += 3) {
      await Promise.all(
        keys.slice(i, i + 3).map(async (key) => {
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
              sheetText: sheetToText(sheet, e.data, { members, anonymise: true, photoCounts: photoCountsFor(template, extracted, key) }),
              contextTexts: contextFor(template, extracted, members, key)
            });
            const r: SheetResult = { gereed: isReady(sheet, out.result), source: out.source, result: out.result };
            try {
              r.vergelyking = await compareFeedback({ sheet, jufText: jufText(e, members), ai: out.result });
            } catch (err) {
              console.error("[pdf-vergelyking] vergelyk", err);
            }
            results[key] = r;
          } catch (err) {
            console.error("[pdf-vergelyking] terugvoer", err);
            results[key] = { fout: err instanceof Error ? err.message.slice(0, 300) : "KI-terugvoer het misluk." };
          }
        })
      );
      await save();
    }
    await db.pdfComparison.update({ where: { id }, data: { status: "klaar", error: null, results: results as unknown as Prisma.InputJsonValue } });
  } catch (e) {
    console.error("[pdf-vergelyking] ki", e);
    await db.pdfComparison.update({ where: { id }, data: { status: "fout", error: e instanceof Error ? e.message.slice(0, 500) : "KI-terugvoer het misluk." } });
  }
}
