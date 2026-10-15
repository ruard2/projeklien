import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { aiConfigured, generateFeedback } from "./ki";
import { buildFeedbackInput, restoreFeedbackInput, snapshotFeedbackInput, type FeedbackInputSnapshot } from "./ki-invoer";

function asSnapshot(value: unknown): FeedbackInputSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Die KI-toets het nie ’n geldige invoer nie.");
  const snapshot = value as Partial<FeedbackInputSnapshot>;
  if (snapshot.version !== 1 || !snapshot.templateKey || !snapshot.sheetKey || !snapshot.project || typeof snapshot.sheetText !== "string" || !Array.isArray(snapshot.contextTexts)) {
    throw new Error("Die KI-toets se invoer is onvolledig.");
  }
  return snapshot as FeedbackInputSnapshot;
}

export async function createOrUpdateEvalCase(args: {
  schoolId: string;
  devFeedbackId: string;
  createdBy: string;
  expectedVerdict: string;
  notes?: string;
}) {
  const devFeedback = await db.devFeedback.findFirst({ where: { id: args.devFeedbackId, schoolId: args.schoolId } });
  if (!devFeedback || devFeedback.kind !== "ki" || !devFeedback.feedbackId || !devFeedback.groupId || !devFeedback.sheet || !devFeedback.criterionId) {
    throw new Error("Hierdie inskrywing is nie aan ’n spesifieke KI-kriterium gekoppel nie.");
  }
  if (!["behaal", "gedeeltelik", "nie_behaal"].includes(args.expectedVerdict)) throw new Error("Kies die verwagte KI-oordeel.");
  const feedback = await db.feedback.findFirst({ where: { id: devFeedback.feedbackId, groupId: devFeedback.groupId, sheet: devFeedback.sheet } });
  if (!feedback) throw new Error("Die oorspronklike KI-antwoord bestaan nie meer nie.");
  const group = await db.group.findUnique({ where: { id: devFeedback.groupId }, include: { project: true } });
  if (!group || group.project.schoolId !== args.schoolId) throw new Error("Groep nie gevind nie.");

  let snapshot: FeedbackInputSnapshot;
  if (feedback.inputSnapshot) {
    snapshot = asSnapshot(feedback.inputSnapshot);
  } else {
    const input = await buildFeedbackInput(devFeedback.groupId, devFeedback.sheet, feedback.revision);
    snapshot = snapshotFeedbackInput(input, devFeedback.sheet);
  }
  const title = `${group.project.title} · ${devFeedback.sheet} · ${devFeedback.criterionId}`;
  const testCase = await db.aiEvalCase.upsert({
    where: { sourceDevFeedbackId: devFeedback.id },
    create: {
      schoolId: args.schoolId,
      sourceDevFeedbackId: devFeedback.id,
      createdBy: args.createdBy,
      title,
      templateKey: snapshot.templateKey,
      sheet: snapshot.sheetKey,
      input: snapshot as unknown as Prisma.InputJsonValue,
      criterionId: devFeedback.criterionId,
      expectedVerdict: args.expectedVerdict,
      notes: args.notes?.trim().slice(0, 2000) || devFeedback.message || null
    },
    update: {
      title,
      input: snapshot as unknown as Prisma.InputJsonValue,
      criterionId: devFeedback.criterionId,
      expectedVerdict: args.expectedVerdict,
      notes: args.notes?.trim().slice(0, 2000) || devFeedback.message || null,
      active: true,
      lastRunAt: null,
      lastPassed: null,
      lastSummary: null,
      lastResult: undefined
    }
  });
  await db.devFeedback.update({ where: { id: devFeedback.id }, data: { expectedVerdict: args.expectedVerdict, regressionStatus: "bygevoeg" } });
  return testCase;
}

export async function runEvalCase(id: string, schoolId?: string) {
  const testCase = await db.aiEvalCase.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) } });
  if (!testCase) throw new Error("KI-toets nie gevind nie.");
  if (!aiConfigured()) throw new Error("OPENAI_API_KEY is nodig om ’n werklike KI-toets te loop.");
  const input = restoreFeedbackInput(asSnapshot(testCase.input));
  const output = await generateFeedback(input);
  const actual = output.result.kriteria.find((criterion) => criterion.id === testCase.criterionId)?.oordeel ?? "ontbreek";
  const passed = actual === testCase.expectedVerdict;
  const summary = passed
    ? `Geslaag: ${testCase.criterionId} = ${actual} (${output.source}).`
    : `Misluk: ${testCase.criterionId} moes ${testCase.expectedVerdict} wees, maar was ${actual} (${output.source}).`;
  await db.aiEvalCase.update({
    where: { id: testCase.id },
    data: {
      lastRunAt: new Date(),
      lastPassed: passed,
      lastSummary: summary,
      lastResult: output.result as unknown as Prisma.InputJsonValue
    }
  });
  return { passed, summary, source: output.source, result: output.result };
}

export async function runActiveEvalCases(schoolId?: string) {
  const cases = await db.aiEvalCase.findMany({ where: { active: true, ...(schoolId ? { schoolId } : {}) }, orderBy: { createdAt: "asc" } });
  const results = [];
  for (const testCase of cases) {
    try {
      results.push({ id: testCase.id, ...(await runEvalCase(testCase.id, schoolId)) });
    } catch (error) {
      const summary = error instanceof Error ? error.message : "Onbekende fout.";
      await db.aiEvalCase.update({ where: { id: testCase.id }, data: { lastRunAt: new Date(), lastPassed: false, lastSummary: summary } });
      results.push({ id: testCase.id, passed: false, summary });
    }
  }
  return results;
}
