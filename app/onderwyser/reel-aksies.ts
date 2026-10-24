"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ALL_WORKBOOKS, logRuleEvent, RULE_MAX } from "@/lib/ki-reels";
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
  const global = templateKey === ALL_WORKBOOKS;
  const template = global ? null : getTemplate(templateKey);
  const [sheetKey, criterionId] = scope.split("|");
  const sheet = sheetKey && template ? template.sheets.find((s) => s.key === sheetKey) : null;
  const rule = await db.aiRule.create({
    data: {
      schoolId: t.schoolId,
      templateKey: global ? ALL_WORKBOOKS : template!.key,
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

export type ImportState = { ok?: string; error?: string } | undefined;

/** Voer ’n lys reëls in (JSON). Formaat: { werkboek, reels: [{ werkblad?, kriterium?, teks }] }. */
export async function importRules(_prev: ImportState, form: FormData): Promise<ImportState> {
  const t = await requireTeacher();
  if (!isAdminRole(t.role)) return { error: "Net administrateurs." };
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return { error: "Kies ’n lêer." };
  let raw: { werkboek?: string; reels?: { werkblad?: string; kriterium?: string; teks?: string }[] };
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { error: "Dit is nie ’n geldige JSON-lêer nie." };
  }
  const global = raw.werkboek === ALL_WORKBOOKS;
  let template = null;
  if (!global) {
    try {
      template = getTemplate(String(raw.werkboek ?? ""));
    } catch {
      return { error: `Onbekende werkboek “${raw.werkboek}”.` };
    }
  }
  const key = global ? ALL_WORKBOOKS : template!.key;
  const list = Array.isArray(raw.reels) ? raw.reels.slice(0, 100) : [];
  let made = 0;
  const skipped: string[] = [];
  for (const r of list) {
    const text = String(r.teks ?? "").trim().slice(0, RULE_MAX);
    const sheet = r.werkblad && template ? template.sheets.find((s) => s.key === r.werkblad) : null;
    if (text.length < 8 || (r.werkblad && !sheet) || (r.kriterium && !sheet?.criteria.some((c) => c.id === r.kriterium))) {
      skipped.push(`${r.werkblad ?? "-"}/${r.kriterium ?? "-"}`);
      continue;
    }
    const exists = await db.aiRule.findFirst({ where: { schoolId: t.schoolId, templateKey: key, text, deletedAt: null } });
    if (exists) continue;
    const rule = await db.aiRule.create({
      data: { schoolId: t.schoolId, templateKey: key, sheet: sheet?.key ?? null, criterionId: r.kriterium ?? null, text, createdById: t.id, createdByName: t.name }
    });
    await logRuleEvent({ ruleId: rule.id, schoolId: t.schoolId, by: t, action: "aangemaak", newText: text, note: `Ingevoer uit lêer (${file instanceof File ? file.name : "json"})` });
    made++;
  }
  done();
  return { ok: `${made} reël(s) bygevoeg${skipped.length ? `; ${skipped.length} oorgeslaan (onbekende werkblad/kriterium: ${skipped.join(", ")})` : ""}.` };
}
