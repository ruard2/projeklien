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

/** Aktiewe reëls vir presies één omvang (werkblad + kriterium, of hele werkblad), nuutste eerste. */
export async function scopeRules(schoolId: string, templateKey: string, sheet: string, criterionId: string | null) {
  return db.aiRule.findMany({
    where: { schoolId, templateKey, sheet, criterionId, active: true, deletedAt: null },
    orderBy: { createdAt: "desc" }
  });
}

/**
 * Stoor ’n reël uit ’n gesprek met die KI. Een reël per kriterium (of per werkblad): bestaan daar reeds een,
 * word dit vervang (omkeerbaar via die geskiedenis) in plaas van ’n tweede reël te maak.
 */
export async function saveRuleFromChat(a: {
  schoolId: string;
  templateKey: string;
  sheet: string;
  criterionId: string;
  omvang: "kriterium" | "werkblad" | "werkboek";
  text: string;
  by: { id: string; name: string; role?: string };
  note: string | null;
  sourceComparisonId?: string | null;
}): Promise<string> {
  if (a.omvang !== "werkboek") {
    const same = await scopeRules(a.schoolId, a.templateKey, a.sheet, a.omvang === "kriterium" ? a.criterionId : null);
    if (same.length) {
      const [keep, ...rest] = same;
      if (keep.text !== a.text) {
        await db.aiRule.update({ where: { id: keep.id }, data: { text: a.text } });
        await logRuleEvent({ ruleId: keep.id, schoolId: a.schoolId, by: a.by, action: "gewysig", oldText: keep.text, newText: a.text, note: a.note ? `${a.note} (vervang bestaande reël)` : "Vervang bestaande reël" });
      }
      for (const r of rest) {
        await db.aiRule.update({ where: { id: r.id }, data: { deletedAt: new Date() } });
        await logRuleEvent({ ruleId: r.id, schoolId: a.schoolId, by: a.by, action: "geskrap", oldText: r.text, note: "Saamgevoeg in een reël per kriterium" });
      }
      return keep.id;
    }
  }
  const rule = await db.aiRule.create({
    data: {
      schoolId: a.schoolId,
      templateKey: a.templateKey,
      sheet: a.omvang === "werkboek" ? null : a.sheet,
      criterionId: a.omvang === "kriterium" ? a.criterionId : null,
      text: a.text,
      createdById: a.by.id,
      createdByName: a.by.name,
      sourceComparisonId: a.sourceComparisonId ?? null
    }
  });
  await logRuleEvent({ ruleId: rule.id, schoolId: a.schoolId, by: a.by, action: "aangemaak", newText: a.text, note: a.note });
  return rule.id;
}
