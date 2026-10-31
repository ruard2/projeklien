"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { anonymisedSheetText, asExtracted, asResults, loadForFeedback, loadOwnComparison, rerunAll, rerunSheet, runExtraction, runFeedback, STALE_MS } from "@/lib/pdf-vergelyking/diens";
import { chatAboutVerdict, type ChatMsg, type Omvang } from "@/lib/pdf-vergelyking/gesprek";
import { logRuleEvent, rulesFor, RULE_MAX, saveRuleFromChat, scopeRules } from "@/lib/ki-reels";
import { cleanSheetData, jufText, membersFrom } from "@/lib/pdf-vergelyking/skema";
import { getTemplate } from "@/lib/werkboeke/sjablone";
import { isAdminRole, requireTeacher } from "@/lib/sessie";
import { logActivity } from "@/lib/aktiwiteit";

const path = (id: string) => `/onderwyser/pdf-vergelyking/${id}`;

export async function approveExtraction(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  if (c.status !== "nagaan") redirect(path(c.id));
  // Die PDF (met name) word nie langer as nodig gehou nie.
  await db.pdfComparison.update({ where: { id: c.id }, data: { status: "ki", pdf: null, error: null } });
  await logActivity(t, "pdf", `Uitlees goedgekeur (akkoord) · ${c.fileName}`, { link: path(c.id) });
  after(() => runFeedback(c.id));
  redirect(path(c.id));
}

export async function retryComparison(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  const busy = (c.status === "uitlees" || c.status === "ki") && Date.now() - c.updatedAt.getTime() < STALE_MS;
  if (busy || (c.status === "nagaan" && !c.pdf)) redirect(path(c.id));
  if (c.pdf && (c.status === "nagaan" || c.status === "fout" || c.status === "uitlees")) {
    await db.pdfComparison.update({ where: { id: c.id }, data: { status: "uitlees", error: null } });
    await logActivity(t, "pdf", `Weer uitgelees · ${c.fileName}`, { link: path(c.id) });
    after(() => runExtraction(c.id));
  } else if (c.extracted) {
    await db.pdfComparison.update({ where: { id: c.id }, data: { status: "ki", error: null } });
    await logActivity(t, "pdf", `KI-terugvoer weer probeer · ${c.fileName}`, { link: path(c.id) });
    after(() => runFeedback(c.id));
  }
  redirect(path(c.id));
}

export async function deleteComparison(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  await db.pdfComparison.delete({ where: { id: c.id } });
  await logActivity(t, "pdf", `Vergelyking geskrap · ${c.fileName}`);
  revalidatePath("/onderwyser/pdf-vergelyking");
  redirect("/onderwyser/pdf-vergelyking");
}

export async function voteCriterion(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  const sheet = String(form.get("sheet") ?? "").slice(0, 40);
  const criterionId = String(form.get("criterion") ?? "").slice(0, 60);
  const vote = form.get("vote") === "-1" ? -1 : 1;
  const where = { comparisonId_sheet_criterionId_teacherId: { comparisonId: c.id, sheet, criterionId, teacherId: t.id } };
  const existing = await db.pdfVote.findUnique({ where });
  if (existing?.vote === vote) await db.pdfVote.delete({ where });
  else await db.pdfVote.upsert({ where, create: { comparisonId: c.id, sheet, criterionId, teacherId: t.id, vote }, update: { vote } });
  revalidatePath(path(c.id));
}

/** Die onderwyser stel die uitlees van een werkblad reg voordat dit na die KI gaan. */
export async function savePdfSheet(input: { id: string; sheet: string; data: unknown; kommentaar: string[]; vorige: string[] }): Promise<{ ok?: true; error?: string }> {
  const t = await requireTeacher();
  try {
    const c = await loadOwnComparison(input.id, t);
    if (c.status !== "nagaan") return { error: "Hierdie uitlees is reeds goedgekeur." };
    const extracted = asExtracted(c.extracted);
    const current = extracted?.sheets[input.sheet];
    const sheet = getTemplate(c.templateKey).sheets.find((s) => s.key === input.sheet);
    if (!extracted || !current || !sheet) return { error: "Werkblad nie gevind nie." };
    if (JSON.stringify(input.data ?? {}).length > 200_000) return { error: "Te veel teks." };
    const lines = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim().slice(0, 1000)).filter(Boolean).slice(0, 40);
    extracted.sheets[input.sheet] = {
      ...current,
      data: cleanSheetData(sheet, input.data),
      juf: { ...current.juf, kommentaar: lines(input.kommentaar), kommentaar_vorige: lines(input.vorige) }
    };
    await db.pdfComparison.update({ where: { id: c.id }, data: { extracted: extracted as unknown as Prisma.InputJsonValue } });
    await logActivity(t, "pdf", `Uitlees reggestel: werkblad ${sheet.number} · ${c.fileName}`, {
      link: path(c.id),
      details: { kind: "wysig", templateKey: c.templateKey, sheet: input.sheet, before: { data: current.data, juf: current.juf }, after: { data: extracted.sheets[input.sheet].data, juf: extracted.sheets[input.sheet].juf } }
    });
    revalidatePath(path(c.id));
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Kon nie stoor nie." };
  }
}

// ---------------------------------------------------------------- Duimpies, gesprek en reëls

type VoteKey = { id: string; sheet: string; criterion: string };

function voteWhere(comparisonId: string, sheet: string, criterionId: string, teacherId: string) {
  return { comparisonId_sheet_criterionId_teacherId: { comparisonId, sheet, criterionId, teacherId } };
}

/** Duim op/af (nogmaals dieselfde = verwyder). */
export async function setVote(k: VoteKey & { vote: 1 | -1 }): Promise<{ vote: number | null; error?: string }> {
  const t = await requireTeacher();
  try {
    const c = await loadOwnComparison(k.id, t);
    const where = voteWhere(c.id, k.sheet.slice(0, 40), k.criterion.slice(0, 60), t.id);
    const existing = await db.pdfVote.findUnique({ where });
    await logActivity(t, "duim", `${k.vote === 1 ? "👍" : "👎"} by werkblad ${k.sheet}, kriterium ${k.criterion} · ${c.fileName}`, { link: path(c.id) });
    if (existing?.vote === k.vote && k.vote === 1) {
      await db.pdfVote.delete({ where });
      revalidatePath(path(c.id));
      return { vote: null };
    }
    await db.pdfVote.upsert({ where, create: { comparisonId: c.id, sheet: k.sheet, criterionId: k.criterion, teacherId: t.id, vote: k.vote }, update: { vote: k.vote } });
    revalidatePath(path(c.id));
    return { vote: k.vote };
  } catch (e) {
    console.error(e);
    return { vote: null, error: "Kon nie stoor nie." };
  }
}

/** Die onderwyser praat met die KI oor ’n oordeel wat nie klop nie. */
export async function chatVote(k: VoteKey & { text: string }): Promise<{ chat?: ChatMsg[]; reel?: string; omvang?: Omvang; error?: string }> {
  const t = await requireTeacher();
  const text = k.text.trim().slice(0, 2000);
  if (!text) return { error: "Skryf eers wat nie klop nie." };
  try {
    const c = await loadOwnComparison(k.id, t);
    const l = await loadForFeedback(c.id);
    const r = asResults(c.results)[k.sheet];
    const verdict = r?.result?.kriteria.find((x) => x.id === k.criterion);
    if (!l || !verdict || !l.extracted.sheets[k.sheet]) return { error: "Hierdie oordeel bestaan nie meer nie." };
    const sheet = l.template.sheets.find((s) => s.key === k.sheet)!;
    const where = voteWhere(c.id, k.sheet, k.criterion, t.id);
    const existing = await db.pdfVote.findUnique({ where });
    const history = [...((existing?.chat as ChatMsg[] | null) ?? []), { van: "juf" as const, teks: text, at: new Date().toISOString() }].slice(-20);
    const out = await chatAboutVerdict({
      sheet,
      criterion: sheet.criteria.find((x) => x.id === k.criterion),
      criterionId: k.criterion,
      verdict: verdict.oordeel,
      feedback: verdict.terugvoer,
      sheetText: anonymisedSheetText(l, k.sheet),
      jufText: jufText(l.extracted.sheets[k.sheet], membersFrom(l.extracted)),
      rules: await rulesFor(c.schoolId, c.templateKey, k.sheet),
      criterionRule: (await scopeRules(c.schoolId, c.templateKey, k.sheet, k.criterion))[0]?.text ?? null,
      history
    });
    const chat: ChatMsg[] = [...history, { van: "ki" as const, teks: out.antwoord, at: new Date().toISOString(), ...(out.reel ? { reel: out.reel, omvang: out.omvang } : {}) }];
    await logActivity(t, "duim", `Gesprek met KI (werkblad ${k.sheet}, kriterium ${k.criterion}): “${text.slice(0, 300)}”`, { link: path(c.id), details: { kind: "gesprek", juf: text, ki: out.antwoord, reel: out.reel } });
    await db.pdfVote.upsert({
      where,
      create: { comparisonId: c.id, sheet: k.sheet, criterionId: k.criterion, teacherId: t.id, vote: -1, reason: text, chat: chat as unknown as Prisma.InputJsonValue },
      update: { vote: -1, reason: existing?.reason ?? text, chat: chat as unknown as Prisma.InputJsonValue }
    });
    return { chat, reel: out.reel, omvang: out.omvang };
  } catch (e) {
    console.error(e);
    return { error: "Die KI kon nie antwoord nie. Probeer weer." };
  }
}

/** Voeg ’n reël by wat dadelik vir alle KI-beoordelings van hierdie werkboek geld. */
export async function addRuleFromVote(k: VoteKey & { text: string; omvang: Omvang }): Promise<{ ok?: true; error?: string }> {
  const t = await requireTeacher();
  const text = k.text.trim().slice(0, RULE_MAX);
  if (text.length < 8) return { error: "Die reël is te kort." };
  try {
    const c = await loadOwnComparison(k.id, t);
    const vote = await db.pdfVote.findUnique({ where: voteWhere(c.id, k.sheet, k.criterion, t.id) });
    const ruleId = await saveRuleFromChat({
      schoolId: c.schoolId,
      templateKey: c.templateKey,
      sheet: k.sheet,
      criterionId: k.criterion,
      omvang: k.omvang,
      text,
      by: t,
      note: vote?.reason ? `Uit gesprek ná 👎: “${vote.reason}”` : null,
      sourceComparisonId: c.id
    });
    await db.pdfVote.updateMany({ where: { comparisonId: c.id, sheet: k.sheet, criterionId: k.criterion, teacherId: t.id }, data: { ruleId } });
    revalidatePath(path(c.id));
    revalidatePath("/onderwyser/ki-reels");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Kon nie die reël stoor nie." };
  }
}

/** Beoordeel een werkblad weer met die huidige reëls. */
export async function rerunSheetAction(k: { id: string; sheet: string }): Promise<{ ok?: true; error?: string }> {
  const t = await requireTeacher();
  try {
    const c = await loadOwnComparison(k.id, t);
    const r = await rerunSheet(c.id, k.sheet);
    await logActivity(t, "pdf", `Werkblad ${k.sheet} weer deur KI beoordeel · ${c.fileName}`, { link: path(c.id) });
    if (!r) return { error: "Werkblad nie gevind nie." };
    if (r.fout) return { error: r.fout };
    revalidatePath(path(c.id));
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { error: "Herbeoordeling het misluk." };
  }
}

/** Hele vergelyking weer deur die KI met die huidige reëls (voor/ná word bewaar). */
export async function rerunAllAction(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  if (c.status === "klaar" || c.status === "fout") {
    await db.pdfComparison.update({ where: { id: c.id }, data: { status: "ki" } });
    await logActivity(t, "pdf", `Hele vergelyking weer deur KI beoordeel (huidige reëls) · ${c.fileName}`, { link: path(c.id) });
    after(() => rerunAll(c.id));
  }
  redirect(path(c.id));
}

/** Admin: beoordeel álle klaar vergelykings weer, een vir een in die agtergrond. */
export async function rerunEverythingAction() {
  const t = await requireTeacher();
  if (!isAdminRole(t.role)) redirect("/onderwyser/ontwikkel");
  const list = await db.pdfComparison.findMany({ where: { schoolId: t.schoolId, status: { in: ["klaar", "fout"] }, NOT: { results: { equals: Prisma.DbNull } } }, select: { id: true }, orderBy: { createdAt: "asc" } });
  if (list.length) {
    await db.pdfComparison.updateMany({ where: { id: { in: list.map((x) => x.id) } }, data: { status: "ki" } });
    await logActivity(t, "pdf", `Alle ${list.length} vergelykings weer deur KI beoordeel (huidige reëls)`, { link: "/onderwyser/pdf-vergelyking" });
    after(async () => {
      for (const x of list) await rerunAll(x.id);
    });
  }
  revalidatePath("/onderwyser/pdf-vergelyking");
  redirect("/onderwyser/ontwikkel");
}

// ---------------------------------------------------------------- Papier → digitale werkboek

async function makeGroup(t: Awaited<ReturnType<typeof requireTeacher>>, id: string) {
  const { createGroupFromComparison, feedbackForPaperGroup } = await import("@/lib/pdf-vergelyking/groep");
  const { group, approved } = await createGroupFromComparison(id, t);
  await logActivity(t, "groepe", `Digitale werkboek uit papier gemaak · ${group.name} (${group.code})${approved.length ? ` · KP ${approved.join(", ")} afgeteken` : ""}`, { link: `/onderwyser/groep/${group.id}` });
  return { group, run: () => feedbackForPaperGroup(id, group.id) };
}

export async function makeGroupFromComparisonAction(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  const { run } = await makeGroup(t, c.id);
  after(run);
  revalidatePath("/onderwyser/pdf-vergelyking");
  redirect(path(c.id));
}

export async function makeAllGroupsAction() {
  const t = await requireTeacher();
  const { pickPaperCandidates } = await import("@/lib/pdf-vergelyking/papier");
  const all = await db.pdfComparison.findMany({
    where: { schoolId: t.schoolId, ...(isAdminRole(t.role) ? {} : { teacherId: t.id }) },
    select: { id: true, templateKey: true, status: true, model: true, createdAt: true, groupId: true, extracted: true }
  });
  const linked = all.map((c) => c.groupId).filter((x): x is string => Boolean(x));
  const made = new Set((linked.length ? await db.group.findMany({ where: { id: { in: linked }, paperImport: true }, select: { id: true } }) : []).map((g) => g.id));
  const list = pickPaperCandidates(all, made).picks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const runs: (() => Promise<void>)[] = [];
  for (const x of list) {
    try {
      runs.push((await makeGroup(t, x.id)).run);
    } catch (e) {
      console.error("[papiergroep]", x.id, e);
    }
  }
  if (runs.length) after(async () => { for (const r of runs) await r(); });
  revalidatePath("/onderwyser/pdf-vergelyking");
  revalidatePath("/onderwyser");
  redirect("/onderwyser/ontwikkel#digitaal");
}
