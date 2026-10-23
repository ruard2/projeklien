// Onderwyserreëls vir die KI-terugvoer. Aktiewe reëls geld dadelik vir elke beoordeling.

import { db } from "./db";
import { getSheet, getTemplate, parseSheetKey } from "./werkboeke/sjablone";

export const RULE_MAX = 500;

/** Die aktiewe reëls vir een werkblad, klaar geformuleer vir die KI-opdrag. */
export async function rulesFor(schoolId: string, templateKey: string, sheetKey: string): Promise<string[]> {
  const { base } = parseSheetKey(sheetKey);
  const rules = await db.aiRule.findMany({
    where: { schoolId, templateKey, active: true, OR: [{ sheet: null }, { sheet: base }] },
    orderBy: { createdAt: "asc" },
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
    const scope = crit ? `[kriterium “${crit.title}”] ` : r.sheet ? "" : "[hele werkboek] ";
    return `${scope}${r.text}`;
  });
}
