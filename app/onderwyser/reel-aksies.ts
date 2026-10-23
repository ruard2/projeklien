"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { RULE_MAX } from "@/lib/ki-reels";
import { isAdminRole, requireTeacher } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";

async function ownRule(id: string) {
  const t = await requireTeacher();
  const rule = await db.aiRule.findFirst({ where: { id, schoolId: t.schoolId } });
  if (!rule) throw new Error("Reël nie gevind nie.");
  if (rule.createdById !== t.id && !isAdminRole(t.role)) throw new Error("Net die skrywer of ’n administrateur kan hierdie reël verander.");
  return rule;
}

export async function toggleRule(form: FormData) {
  const rule = await ownRule(String(form.get("id")));
  await db.aiRule.update({ where: { id: rule.id }, data: { active: !rule.active } });
  revalidatePath("/onderwyser/ki-reels");
}

export async function deleteRule(form: FormData) {
  const rule = await ownRule(String(form.get("id")));
  await db.aiRule.delete({ where: { id: rule.id } });
  revalidatePath("/onderwyser/ki-reels");
}

export async function updateRule(form: FormData) {
  const rule = await ownRule(String(form.get("id")));
  const text = String(form.get("text") ?? "").trim().slice(0, RULE_MAX);
  if (text.length >= 8) await db.aiRule.update({ where: { id: rule.id }, data: { text } });
  revalidatePath("/onderwyser/ki-reels");
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
  await db.aiRule.create({
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
  revalidatePath("/onderwyser/ki-reels");
}
