"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logRuleEvent, RULE_MAX } from "@/lib/ki-reels";
import { isAdminRole, requireTeacher } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";

// Elke handeling word in AiRuleEvent aangeteken; niks word ooit hard geskrap nie.

async function ownRule(id: string) {
  const t = await requireTeacher();
  const rule = await db.aiRule.findFirst({ where: { id, schoolId: t.schoolId } });
  if (!rule) throw new Error("Reël nie gevind nie.");
  if (rule.createdById !== t.id && !isAdminRole(t.role)) throw new Error("Net die skrywer of ’n administrateur kan hierdie reël verander.");
  return { t, rule };
}

const done = () => revalidatePath("/onderwyser/ki-reels");

export async function toggleRule(form: FormData) {
  const { t, rule } = await ownRule(String(form.get("id")));
  await db.aiRule.update({ where: { id: rule.id }, data: { active: !rule.active } });
  await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: t, action: rule.active ? "afgeskakel" : "aangeskakel" });
  done();
}

export async function deleteRule(form: FormData) {
  const { t, rule } = await ownRule(String(form.get("id")));
  await db.aiRule.update({ where: { id: rule.id }, data: { deletedAt: new Date() } });
  await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: t, action: "geskrap", oldText: rule.text });
  done();
}

export async function restoreRule(form: FormData) {
  const { t, rule } = await ownRule(String(form.get("id")));
  await db.aiRule.update({ where: { id: rule.id }, data: { deletedAt: null } });
  await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: t, action: "herstel", newText: rule.text });
  done();
}

export async function updateRule(form: FormData) {
  const { t, rule } = await ownRule(String(form.get("id")));
  const text = String(form.get("text") ?? "").trim().slice(0, RULE_MAX);
  if (text.length < 8 || text === rule.text) return done();
  await db.aiRule.update({ where: { id: rule.id }, data: { text } });
  await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: t, action: "gewysig", oldText: rule.text, newText: text });
  done();
}

/** Draai ’n reël terug na die teks van ’n vroeëre gebeurtenis. */
export async function revertRule(form: FormData) {
  const { t, rule } = await ownRule(String(form.get("id")));
  const ev = await db.aiRuleEvent.findFirst({ where: { id: String(form.get("eventId")), ruleId: rule.id } });
  const text = ev?.oldText ?? ev?.newText;
  if (!ev || !text || text === rule.text) return done();
  await db.aiRule.update({ where: { id: rule.id }, data: { text } });
  await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: t, action: "teruggedraai", oldText: rule.text, newText: text, note: `Na weergawe van ${ev.at.toLocaleString("af-ZA")}` });
  done();
}

export async function createRule(form: FormData) {
  const t = await requireTeacher();
  const templateKey = String(form.get("templateKey") ?? "");
  const scope = String(form.get("scope") ?? "");
  const text = String(form.get("text") ?? "").trim().slice(0, RULE_MAX);
  if (text.length < 8) return;
  const template = getTemplate(templateKey);
  const [sheetKey, criterionId] = scope.split("|");
  const sheet = sheetKey ? template.sheets.find((s) => s.key === sheetKey) : null;
  const rule = await db.aiRule.create({
    data: {
      schoolId: t.schoolId,
      templateKey: template.key,
      sheet: sheet?.key ?? null,
      criterionId: sheet && criterionId && sheet.criteria.some((c) => c.id === criterionId) ? criterionId : null,
      text,
      createdById: t.id,
      createdByName: t.name
    }
  });
  await logRuleEvent({ ruleId: rule.id, schoolId: t.schoolId, by: t, action: "aangemaak", newText: text, note: "Handmatig op die KI-reëls-bladsy" });
  done();
}
