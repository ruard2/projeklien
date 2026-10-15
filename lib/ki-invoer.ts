import { db } from "./db";
import type { FeedbackInput } from "./ki";
import { getSheet, getTemplate, parseSheetKey } from "./werkboeke/sjablone";
import { sheetToText } from "./werkboeke/teks";
import type { SheetData } from "./werkboeke/tipes";

export type FeedbackInputSnapshot = {
  version: 1;
  templateKey: string;
  sheetKey: string;
  project: FeedbackInput["project"];
  sheetText: string;
  contextTexts: FeedbackInput["contextTexts"];
  extraContext?: string;
};

function asData(value: unknown): SheetData {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as SheetData) : {};
}

function membersOf(value: unknown): string[] {
  const members = Array.isArray(value) ? value : [];
  return [0, 1, 2, 3].map((index) => (typeof members[index] === "string" ? members[index] : ""));
}

async function photoCountsFor(groupId: string, sheet: string): Promise<Record<string, number>> {
  const rows = await db.photo.groupBy({ by: ["field"], where: { groupId, sheet }, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.field, row._count._all]));
}

/** Bou dieselfde geanonimiseerde KI-invoer as die gewone terugvoervloei. */
export async function buildFeedbackInput(groupId: string, sheetKey: string, revision?: number): Promise<FeedbackInput> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { project: true, responses: true, checkpoints: true }
  });
  if (!group) throw new Error("Groep nie gevind nie.");
  const template = getTemplate(group.project.templateKey);
  const sheet = getSheet(template, sheetKey);
  if (!sheet) throw new Error("Werkblad nie gevind nie.");
  const response = group.responses.find((item) => item.sheet === sheetKey);
  if (!response) throw new Error("Die groep het nog geen antwoord op hierdie werkblad nie.");

  const version = revision === undefined
    ? null
    : await db.responseVersion.findFirst({ where: { groupId, sheet: sheetKey, revision }, orderBy: { createdAt: "desc" } });
  const data = asData(version?.data ?? response.data);
  const members = membersOf(group.members);
  const photoCounts = await photoCountsFor(groupId, sheetKey);
  const contextTexts = (
    await Promise.all((sheet.context ?? []).map(async (contextKey) => {
      const contextSheet = template.sheets.find((item) => item.key === contextKey);
      const contextResponse = group.responses.find((item) => item.sheet === contextKey);
      if (!contextSheet || !contextResponse) return null;
      return {
        title: `Werkblad ${contextSheet.number}: ${contextSheet.title}`,
        text: sheetToText(contextSheet, asData(contextResponse.data), {
          members,
          anonymise: true,
          photoCounts: await photoCountsFor(groupId, contextKey)
        })
      };
    }))
  ).filter((item): item is { title: string; text: string } => Boolean(item));

  let extraContext: string | undefined;
  if (sheet.key === "ws14") {
    extraContext = `WERKLIKE STAND VAN KONTROLEPUNTE: ${template.checkpoints
      .map((checkpoint) => `Kontrolepunt ${checkpoint.number}: ${group.checkpoints.find((item) => item.number === checkpoint.number)?.status === "APPROVED" ? "afgeteken" : "nog nie afgeteken nie"}`)
      .join("; ")}.`;
  }
  const { member } = parseSheetKey(sheetKey);
  if (member) {
    extraContext = [extraContext, `Hierdie is die persoonlike refleksie van Lid ${member}. Gebruik die rolverdeling en die projekverloop as konteks, maar beoordeel net wat hierdie lid self geskryf het.`]
      .filter(Boolean)
      .join("\n");
  }

  return {
    template,
    sheet,
    project: {
      phenomenon: group.project.phenomenon,
      question: group.project.question,
      partner: group.project.partner,
      grade: group.project.grade
    },
    sheetText: sheetToText(sheet, data, { members, anonymise: true, photoCounts }),
    contextTexts,
    extraContext
  };
}

export function snapshotFeedbackInput(input: FeedbackInput, sheetKey: string): FeedbackInputSnapshot {
  return {
    version: 1,
    templateKey: input.template.key,
    sheetKey,
    project: input.project,
    sheetText: input.sheetText,
    contextTexts: input.contextTexts,
    ...(input.extraContext ? { extraContext: input.extraContext } : {})
  };
}

export function restoreFeedbackInput(snapshot: FeedbackInputSnapshot): FeedbackInput {
  if (snapshot.version !== 1) throw new Error("Onbekende KI-invoerweergawe.");
  const template = getTemplate(snapshot.templateKey);
  const sheet = getSheet(template, snapshot.sheetKey);
  if (!sheet) throw new Error("Die toets se werkblad bestaan nie meer nie.");
  return {
    template,
    sheet,
    project: snapshot.project,
    sheetText: snapshot.sheetText,
    contextTexts: snapshot.contextTexts,
    extraContext: snapshot.extraContext
  };
}
