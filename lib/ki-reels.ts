// Onderwyserreëls vir die KI-terugvoer. Aktiewe reëls geld dadelik vir elke beoordeling.

import { db } from "./db";
import { getSheet, getTemplate, parseSheetKey } from "./werkboeke/sjablone";

export const RULE_MAX = 1200;
/** templateKey vir reëls wat vir alle werkboeke geld (algemene gees). */
export const ALL_WORKBOOKS = "*";

/** Die aktiewe reëls vir een werkblad, klaar geformuleer vir die KI-opdrag. */
export async function rulesFor(schoolId: string, templateKey: string, sheetKey: string): Promise<string[]> {
  const { base } = parseSheetKey(sheetKey);
  const rules = await db.aiRule.findMany({
    where: { schoolId, templateKey: { in: [ALL_WORKBOOKS, templateKey] }, active: true, deletedAt: null, OR: [{ sheet: null }, { sheet: base }] },
    // Algemene reëls eerste, dan die werkboek se eie, dan per werkblad/kriterium.
    orderBy: [{ templateKey: "asc" }, { createdAt: "asc" }],
    take: 40
  });
  let sheet = null;
  try {
    sheet = getSheet(getTemplate(templateKey), sheetKey);
  } catch {
    sheet = null;
  }
  return rules.map((r) => {
    const crit = r.criterionId ? sheet?.criteria.find((c) => c.id === r.criterionId) : null;
    const scope = r.templateKey === ALL_WORKBOOKS ? "[algemene gees – alle werkboeke] " : crit ? `[kriterium “${crit.title}”] ` : r.sheet ? "" : "[hele werkboek] ";
    return `${scope}${r.text}`;
  });
}

/** Teken ’n handeling op ’n reël aan (ouditspoor). */
export async function logRuleEvent(e: {
  ruleId: string;
  schoolId: string;
  by: { id: string; name: string; role?: string };
  action: "aangemaak" | "gewysig" | "afgeskakel" | "aangeskakel" | "geskrap" | "herstel" | "teruggedraai";
  oldText?: string | null;
  newText?: string | null;
  note?: string | null;
}) {
  await db.aiRuleEvent.create({
    data: {
      ruleId: e.ruleId,
      schoolId: e.schoolId,
      byId: e.by.id,
      byName: e.by.name,
      action: e.action,
      oldText: e.oldText ?? null,
      newText: e.newText ?? null,
      note: e.note?.slice(0, 2000) ?? null,
      // Handelinge van administrateurs/ontwikkelaars hoef nie weer nagegaan te word nie.
      ...(e.by.role === "ADMIN" || e.by.role === "DEVELOPER" ? { reviewedAt: new Date(), reviewedByName: e.by.name } : {})
    }
  });
}
