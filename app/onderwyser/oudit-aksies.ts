"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logRuleEvent } from "@/lib/ki-reels";
import { requireAdmin } from "@/lib/sessie";

const done = () => {
  revalidatePath("/onderwyser/aktiwiteit");
  revalidatePath("/onderwyser/ki-reels");
  revalidatePath("/onderwyser", "layout");
};

export async function markRuleEventReviewed(form: FormData) {
  const a = await requireAdmin();
  await db.aiRuleEvent.updateMany({ where: { id: String(form.get("eventId")), schoolId: a.schoolId, reviewedAt: null }, data: { reviewedAt: new Date(), reviewedByName: a.name } });
  done();
}

export async function markAllRuleEventsReviewed(form: FormData) {
  const a = await requireAdmin();
  const teacherId = String(form.get("teacherId") ?? "");
  await db.aiRuleEvent.updateMany({ where: { schoolId: a.schoolId, reviewedAt: null, ...(teacherId ? { byId: teacherId } : {}) }, data: { reviewedAt: new Date(), reviewedByName: a.name } });
  done();
}

/** Admin keur ’n reëlverandering af: draai terug (wysiging), skakel af (nuwe reël) of herstel (skrap). */
export async function rejectRuleEvent(form: FormData) {
  const a = await requireAdmin();
  const ev = await db.aiRuleEvent.findFirst({ where: { id: String(form.get("eventId")), schoolId: a.schoolId }, include: { rule: true } });
  if (!ev) return done();
  const rule = ev.rule;
  if ((ev.action === "gewysig" || ev.action === "teruggedraai") && ev.oldText) {
    await db.aiRule.update({ where: { id: rule.id }, data: { text: ev.oldText } });
    await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: a, action: "teruggedraai", oldText: rule.text, newText: ev.oldText, note: `Afgekeur deur administrateur (wysiging deur ${ev.byName})` });
  } else if (ev.action === "aangemaak" || ev.action === "aangeskakel" || ev.action === "herstel") {
    if (rule.active && !rule.deletedAt) {
      await db.aiRule.update({ where: { id: rule.id }, data: { active: false } });
      await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: a, action: "afgeskakel", note: `Afgekeur deur administrateur (${ev.action} deur ${ev.byName})` });
    }
  } else if (ev.action === "geskrap" && rule.deletedAt) {
    await db.aiRule.update({ where: { id: rule.id }, data: { deletedAt: null } });
    await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: a, action: "herstel", newText: rule.text, note: `Afgekeur deur administrateur (geskrap deur ${ev.byName})` });
  } else if (ev.action === "afgeskakel" && !rule.active) {
    await db.aiRule.update({ where: { id: rule.id }, data: { active: true } });
    await logRuleEvent({ ruleId: rule.id, schoolId: rule.schoolId, by: a, action: "aangeskakel", note: `Afgekeur deur administrateur (afgeskakel deur ${ev.byName})` });
  }
  await db.aiRuleEvent.update({ where: { id: ev.id }, data: { reviewedAt: new Date(), reviewedByName: `${a.name} (afgekeur)` } });
  done();
}
