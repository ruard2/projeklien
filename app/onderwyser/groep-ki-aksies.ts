"use server";

// 👍/👎 en gesprekke oor die KI-terugvoer wat groepe in die app kry (per kriterium).

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DiensFout, requestFeedback } from "@/lib/diens";
import { buildFeedbackInput } from "@/lib/ki-invoer";
import type { FeedbackResult } from "@/lib/ki";
import { rulesFor, RULE_MAX, saveRuleFromChat, scopeRules } from "@/lib/ki-reels";
import { chatAboutVerdict, type ChatMsg, type Omvang } from "@/lib/pdf-vergelyking/gesprek";
import { getSheet, getTemplate } from "@/lib/werkboeke/sjablone";
import { requireTeacher } from "@/lib/sessie";
import { logActivity } from "@/lib/aktiwiteit";

type Key = { id: string; sheet: string; criterion: string };

async function own(feedbackId: string) {
  const t = await requireTeacher();
  const fb = await db.feedback.findFirst({
    where: { id: feedbackId, group: { project: { schoolId: t.schoolId } } },
    include: { group: { select: { id: true, name: true, code: true, project: { select: { templateKey: true, schoolId: true } } } } }
  });
  if (!fb) throw new DiensFout("Terugvoer nie gevind nie.", 404);
  return { t, fb };
}

const where = (feedbackId: string, criterionId: string, teacherId: string) => ({ feedbackId_criterionId_teacherId: { feedbackId, criterionId, teacherId } });
const page = (groupId: string, sheet: string) => `/onderwyser/groep/${groupId}/${encodeURIComponent(sheet)}`;
const label = (g: { name: string | null; code: string }) => g.name ?? g.code;

export async function fbSetVote(k: Key & { vote: 1 | -1 }): Promise<{ vote: number | null; error?: string }> {
  try {
    const { t, fb } = await own(k.id);
    const w = where(fb.id, k.criterion.slice(0, 60), t.id);
    const existing = await db.feedbackVote.findUnique({ where: w });
    await logActivity(t, "duim", `${k.vote === 1 ? "👍" : "👎"} op KI-terugvoer · werkblad ${fb.sheet}, kriterium ${k.criterion} · ${label(fb.group)}`, { link: page(fb.group.id, fb.sheet) });
    if (existing?.vote === k.vote && k.vote === 1) {
      await db.feedbackVote.delete({ where: w });
      return { vote: null };
    }
    await db.feedbackVote.upsert({
      where: w,
      create: { feedbackId: fb.id, groupId: fb.group.id, sheet: fb.sheet, criterionId: k.criterion, teacherId: t.id, vote: k.vote },
      update: { vote: k.vote }
    });
    return { vote: k.vote };
  } catch (e) {
    console.error(e);
    return { vote: null, error: "Kon nie stoor nie." };
  }
}

export async function fbChatVote(k: Key & { text: string }): Promise<{ chat?: ChatMsg[]; reel?: string; omvang?: Omvang; error?: string }> {
  const text = k.text.trim().slice(0, 2000);
  if (!text) return { error: "Skryf eers wat nie klop nie." };
  try {
    const { t, fb } = await own(k.id);
    const template = getTemplate(fb.group.project.templateKey);
    const sheet = getSheet(template, fb.sheet);
    const result = fb.result as unknown as FeedbackResult;
    const verdict = result?.kriteria?.find((x) => x.id === k.criterion);
    if (!sheet || !verdict) return { error: "Hierdie oordeel bestaan nie meer nie." };
    const snap = fb.inputSnapshot as { sheetText?: string } | null;
    const sheetText = snap?.sheetText ?? (await buildFeedbackInput(fb.group.id, fb.sheet, fb.revision)).sheetText;
    const resp = await db.response.findUnique({ where: { groupId_sheet: { groupId: fb.group.id, sheet: fb.sheet } }, select: { teacherNotes: true } });
    const paper = (resp?.teacherNotes as Record<string, { text?: string }> | null)?._papier?.text ?? "";
    const w = where(fb.id, k.criterion, t.id);
    const existing = await db.feedbackVote.findUnique({ where: w });
    const history = [...((existing?.chat as ChatMsg[] | null) ?? []), { van: "juf" as const, teks: text, at: new Date().toISOString() }].slice(-20);
    const out = await chatAboutVerdict({
      sheet,
      criterion: sheet.criteria.find((x) => x.id === k.criterion),
      criterionId: k.criterion,
      verdict: verdict.oordeel,
      feedback: verdict.terugvoer,
      sheetText,
      jufText: paper,
      rules: await rulesFor(fb.group.project.schoolId, template.key, fb.sheet),
      criterionRule: (await scopeRules(fb.group.project.schoolId, template.key, fb.sheet, k.criterion))[0]?.text ?? null,
      history
    });
    const chat: ChatMsg[] = [...history, { van: "ki" as const, teks: out.antwoord, at: new Date().toISOString(), ...(out.reel ? { reel: out.reel, omvang: out.omvang } : {}) }];
    await logActivity(t, "duim", `Gesprek met KI (werkblad ${fb.sheet}, kriterium ${k.criterion} · ${label(fb.group)}): “${text.slice(0, 300)}”`, { link: page(fb.group.id, fb.sheet), details: { kind: "gesprek", juf: text, ki: out.antwoord, reel: out.reel } });
    await db.feedbackVote.upsert({
      where: w,
      create: { feedbackId: fb.id, groupId: fb.group.id, sheet: fb.sheet, criterionId: k.criterion, teacherId: t.id, vote: -1, reason: text, chat: chat as unknown as Prisma.InputJsonValue },
      update: { vote: -1, reason: existing?.reason ?? text, chat: chat as unknown as Prisma.InputJsonValue }
    });
    return { chat, reel: out.reel, omvang: out.omvang };
  } catch (e) {
    console.error(e);
    return { error: "Die KI kon nie antwoord nie. Probeer weer." };
  }
}

export async function fbAddRule(k: Key & { text: string; omvang: Omvang }): Promise<{ ok?: true; error?: string }> {
  const text = k.text.trim().slice(0, RULE_MAX);
  if (text.length < 8) return { error: "Die reël is te kort." };
  try {
    const { t, fb } = await own(k.id);
    const vote = await db.feedbackVote.findUnique({ where: where(fb.id, k.criterion, t.id) });
    const ruleId = await saveRuleFromChat({
      schoolId: fb.group.project.schoolId,
      templateKey: fb.group.project.templateKey,
      sheet: fb.sheet,
      criterionId: k.criterion,
      omvang: k.omvang,
      text,
      by: t,
      note: vote?.reason ? `Uit gesprek ná 👎 by groep ${label(fb.group)}: “${vote.reason}”` : null
    });
    await db.feedbackVote.updateMany({ where: { feedbackId: fb.id, criterionId: k.criterion, teacherId: t.id }, data: { ruleId } });
    revalidatePath("/onderwyser/ki-reels");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Kon nie die reël stoor nie." };
  }
}

/** Die onderwyser vra nuwe KI-terugvoer vir hierdie werkblad (met die huidige reëls). */
export async function fbRerun(k: { id: string; sheet: string }): Promise<{ ok?: true; error?: string }> {
  try {
    const { t, fb } = await own(k.id);
    await requestFeedback(fb.group.id, fb.sheet, { byTeacher: true });
    await logActivity(t, "pdf", `Nuwe KI-terugvoer gevra deur onderwyser · werkblad ${fb.sheet} · ${label(fb.group)}`, { link: page(fb.group.id, fb.sheet) });
    revalidatePath(page(fb.group.id, fb.sheet));
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: e instanceof DiensFout ? e.message : "Kon nie nuwe terugvoer kry nie." };
  }
}
