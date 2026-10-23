"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decideCheckpoint, DiensFout, reopenCheckpoint, saveTeacherNote, teacherMarkReady } from "@/lib/diens";
import { createOrUpdateEvalCase, runActiveEvalCases, runEvalCase } from "@/lib/evaluasie";
import { newGroupCode } from "@/lib/kodes";
import { requireAdmin, requireFeedbackReviewer, requireTeacher } from "@/lib/sessie";
import { DEV_FEEDBACK_STATUSES, EXPECTED_VERDICTS, FEEDBACK_SCOPES, ISSUE_TYPES, REGRESSION_STATUSES, cleanText, isOneOf } from "@/lib/terugvoer-beheer";
import { getTemplate, listTemplates } from "@/lib/werkboeke/sjablone";
import { hashPassword } from "@/lib/wagwoord";
import { logActivity } from "@/lib/aktiwiteit";

export type ActionState = { error?: string; ok?: string } | undefined;

async function ownGroup(groupId: string) {
  const t = await requireTeacher();
  const g = await db.group.findUnique({ where: { id: groupId }, include: { project: true } });
  if (!g || g.project.schoolId !== t.schoolId) throw new DiensFout("Groep nie gevind nie.", 404);
  return { t, g };
}

function groupLabel(g: { name: string | null; klas: string | null; code: string }) {
  return [g.name, g.klas ? `klas ${g.klas}` : null, g.code].filter(Boolean).join(" · ");
}

async function attempt(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await fn();
    return { ok: ok || "Gestoor." };
  } catch (e) {
    if (e instanceof DiensFout) return { error: e.message };
    console.error(e);
    return { error: "Iets het verkeerd geloop." };
  }
}

// ---------------------------------------------------------------- Kontrolepunte

export async function decide(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const groupId = String(form.get("groupId"));
    const n = Number(form.get("n"));
    const decision = form.get("decision") === "APPROVED" ? "APPROVED" : "RETURNED";
    const comment = String(form.get("comment") ?? "").trim().slice(0, 4000);
    const { t, g } = await ownGroup(groupId);
    await decideCheckpoint({ id: t.id, name: t.name }, groupId, n, decision, comment);
    await logActivity(t, "kontrolepunt", `${decision === "APPROVED" ? "Afgeteken" : "Teruggestuur"}: kontrolepunt ${n} · ${groupLabel(g)}${comment ? ` – “${comment}”` : ""}`, { link: `/onderwyser/groep/${groupId}#kp${n}` });
    revalidatePath(`/onderwyser/groep/${groupId}`);
    revalidatePath("/onderwyser");
    return decision === "APPROVED" ? `Kontrolepunt ${n} is afgeteken.` : `Kontrolepunt ${n} is teruggestuur.`;
  });
}

export async function reopen(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const groupId = String(form.get("groupId"));
    const n = Number(form.get("n"));
    const comment = String(form.get("comment") ?? "").trim().slice(0, 4000);
    const { t, g } = await ownGroup(groupId);
    await reopenCheckpoint({ id: t.id, name: t.name }, groupId, n, comment || "Heropen deur die onderwyser.");
    await logActivity(t, "kontrolepunt", `Heropen: kontrolepunt ${n} · ${groupLabel(g)}${comment ? ` – “${comment}”` : ""}`, { link: `/onderwyser/groep/${groupId}#kp${n}` });
    revalidatePath(`/onderwyser/groep/${groupId}`);
    return `Kontrolepunt ${n} is weer oop vir die groep.`;
  });
}

export async function markReady(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const groupId = String(form.get("groupId"));
    const sheet = String(form.get("sheet"));
    const { t, g } = await ownGroup(groupId);
    await teacherMarkReady({ name: t.name }, groupId, sheet);
    await logActivity(t, "gereed", `Werkblad ${sheet} as gereed verklaar (KI oorheers) · ${groupLabel(g)}`, { link: `/onderwyser/groep/${groupId}/${encodeURIComponent(sheet)}` });
    revalidatePath(`/onderwyser/groep/${groupId}`);
    return "Werkblad is as gereed gemerk.";
  });
}

export async function teacherNote(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const groupId = String(form.get("groupId"));
    const sheet = String(form.get("sheet"));
    const field = String(form.get("field"));
    const text = String(form.get("text") ?? "");
    const { t, g } = await ownGroup(groupId);
    await saveTeacherNote({ name: t.name }, groupId, sheet, field, text);
    await logActivity(t, "kommentaar", `Kommentaar op werkblad ${sheet} · ${groupLabel(g)}: “${text.trim().slice(0, 300)}”`, { link: `/onderwyser/groep/${groupId}/${encodeURIComponent(sheet)}` });
    revalidatePath(`/onderwyser/groep/${groupId}/${encodeURIComponent(sheet)}`);
    return "Kommentaar gestoor.";
  });
}

// ---------------------------------------------------------------- Groepe

export async function createGroups(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const t = await requireTeacher();
    const projectId = String(form.get("projectId"));
    const klas = String(form.get("klas") ?? "").trim().slice(0, 20) || null;
    const count = Math.max(1, Math.min(30, Number(form.get("count")) || 1));
    const project = await db.project.findFirst({ where: { id: projectId, schoolId: t.schoolId } });
    if (!project) throw new DiensFout("Kies ’n projek.");
    let made = 0;
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 5; tries++) {
        try {
          await db.group.create({ data: { projectId, klas, code: newGroupCode(project.grade) } });
          made++;
          break;
        } catch {
          /* kode bestaan reeds – probeer weer */
        }
      }
    }
    await logActivity(t, "groepe", `${made} groepkode(s) geskep · ${project.title}${klas ? ` · klas ${klas}` : ""}`, { link: "/onderwyser/groepe" });
    revalidatePath("/onderwyser/groepe");
    revalidatePath("/onderwyser");
    return `${made} nuwe groepkode(s) geskep.`;
  });
}

export async function archiveGroup(form: FormData) {
  const { t, g } = await ownGroup(String(form.get("groupId")));
  await db.group.update({ where: { id: g.id }, data: { archived: !g.archived } });
  await logActivity(t, "groepe", `${g.archived ? "Groep herstel" : "Groep geargiveer"} · ${groupLabel(g)}`, { link: `/onderwyser/groep/${g.id}` });
  revalidatePath("/onderwyser/groepe");
  revalidatePath("/onderwyser");
}

// ---------------------------------------------------------------- Bestuur (admin)

export async function createProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const a = await requireAdmin();
    const templateKey = String(form.get("templateKey"));
    if (!listTemplates().some((x) => x.key === templateKey)) throw new DiensFout("Kies ’n werkboek.");
    const tpl = getTemplate(templateKey);
    const year = Number(form.get("year")) || new Date().getFullYear();
    await db.project.create({
      data: {
        schoolId: a.schoolId,
        templateKey,
        title: String(form.get("title") || tpl.label).slice(0, 80),
        grade: tpl.grade,
        year,
        phenomenon: tpl.defaults.phenomenon,
        question: tpl.defaults.question,
        partner: tpl.defaults.partner
      }
    });
    await logActivity(a, "bestuur", `Projek geskep: ${String(form.get("title") || tpl.label).slice(0, 80)} (${year})`, { link: "/onderwyser/beheer" });
    revalidatePath("/onderwyser/beheer");
    return "Projek geskep.";
  });
}

export async function toggleProject(form: FormData) {
  const a = await requireAdmin();
  const p = await db.project.findFirst({ where: { id: String(form.get("projectId")), schoolId: a.schoolId } });
  if (p) {
    await db.project.update({ where: { id: p.id }, data: { active: !p.active } });
    await logActivity(a, "bestuur", `Projek ${p.active ? "gedeaktiveer" : "geaktiveer"}: ${p.title}`, { link: "/onderwyser/beheer" });
  }
  revalidatePath("/onderwyser/beheer");
}

export async function createTeacher(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const a = await requireAdmin();
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const requestedRole = String(form.get("role") ?? "TEACHER");
    const role = requestedRole === "DEVELOPER" ? "DEVELOPER" : requestedRole === "ADMIN" ? "ADMIN" : "TEACHER";
    if (!name || !email.includes("@")) throw new DiensFout("Vul ’n naam en geldige e-pos in.");
    if (password.length < 8) throw new DiensFout("Die wagwoord moet minstens 8 karakters wees.");
    if (await db.teacher.findUnique({ where: { email } })) throw new DiensFout("Daar is reeds ’n onderwyser met hierdie e-pos.");
    await db.teacher.create({ data: { schoolId: a.schoolId, name, email, role, passwordHash: await hashPassword(password) } });
    await logActivity(a, "bestuur", `Onderwyser bygevoeg: ${name} (${email}, ${role})`, { link: "/onderwyser/beheer" });
    revalidatePath("/onderwyser/beheer");
    return `${name} is bygevoeg.`;
  });
}

export async function toggleTeacher(form: FormData) {
  const a = await requireAdmin();
  const t = await db.teacher.findFirst({ where: { id: String(form.get("teacherId")), schoolId: a.schoolId } });
  if (t && t.id !== a.id) {
    await db.teacher.update({ where: { id: t.id }, data: { active: !t.active } });
    await logActivity(a, "bestuur", `Onderwyser ${t.active ? "gedeaktiveer" : "geaktiveer"}: ${t.name}`, { link: "/onderwyser/beheer" });
  }
  revalidatePath("/onderwyser/beheer");
}

export async function changeTeacherRole(form: FormData) {
  const a = await requireAdmin();
  const teacherId = String(form.get("teacherId"));
  const role = String(form.get("role"));
  if (!isOneOf(role, ["DEVELOPER", "ADMIN", "TEACHER"] as const)) return;
  if (teacherId === a.id) return;
  const target = await db.teacher.findFirst({ where: { id: teacherId, schoolId: a.schoolId }, select: { name: true, role: true } });
  await db.teacher.updateMany({ where: { id: teacherId, schoolId: a.schoolId }, data: { role } });
  if (target) await logActivity(a, "bestuur", `Rol van ${target.name}: ${target.role} → ${role}`, { link: "/onderwyser/beheer" });
  revalidatePath("/onderwyser/beheer");
}

export async function changeOwnPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const t = await requireTeacher();
    const pw = String(form.get("password") ?? "");
    if (pw.length < 8) throw new DiensFout("Minstens 8 karakters.");
    await db.teacher.update({ where: { id: t.id }, data: { passwordHash: await hashPassword(pw) } });
    await logActivity(t, "rekening", "Eie wagwoord verander");
    return "Wagwoord verander.";
  });
}

// ---------------------------------------------------------------- Terugvoer aan die ontwikkelaar

const RATINGS = ["reg", "te_streng", "te_sag", "verkeerd", "fout", "voorstel", "vraag", "ander"];

export async function sendDevFeedback(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const t = await requireTeacher();
    const kind = form.get("kind") === "ki" ? "ki" : "algemeen";
    const rating = String(form.get("rating") ?? "");
    const message = cleanText(form.get("message"), 4000);
    if (!message && !rating) throw new DiensFout("Skryf asseblief ’n kort opmerking.");
    const groupId = String(form.get("groupId") ?? "") || null;
    const sheet = String(form.get("sheet") ?? "").slice(0, 40) || null;
    const feedbackId = String(form.get("feedbackId") ?? "") || null;
    if (groupId) {
      const g = await db.group.findFirst({ where: { id: groupId, project: { schoolId: t.schoolId } }, select: { id: true } });
      if (!g) throw new DiensFout("Groep nie gevind nie.");
    }
    if (kind === "ki") {
      if (!groupId || !sheet || !feedbackId) throw new DiensFout("Kies ’n bestaande KI-antwoord om te beoordeel.");
      const feedback = await db.feedback.findFirst({ where: { id: feedbackId, groupId, sheet }, select: { id: true } });
      if (!feedback) throw new DiensFout("Hierdie KI-antwoord kon nie gevind word nie.");
    }
    await db.devFeedback.create({
      data: {
        schoolId: t.schoolId,
        teacherId: t.id,
        teacherName: t.name,
        kind,
        rating: RATINGS.includes(rating) ? rating : null,
        message,
        page: String(form.get("page") ?? "").slice(0, 300) || null,
        groupId,
        sheet,
        feedbackId,
        criterionId: String(form.get("criterionId") ?? "").slice(0, 60) || null,
        issueType: isOneOf(String(form.get("issueType") ?? ""), ISSUE_TYPES) ? String(form.get("issueType")) : null,
        expectedVerdict: isOneOf(String(form.get("expectedVerdict") ?? ""), EXPECTED_VERDICTS) ? String(form.get("expectedVerdict")) : null,
        scope: isOneOf(String(form.get("scope") ?? ""), FEEDBACK_SCOPES) ? String(form.get("scope")) : null
      }
    });
    await logActivity(t, "terugvoer", `Terugvoer aan ontwikkelaar (${kind}${rating ? `, ${rating}` : ""}): “${message.slice(0, 300)}”`, { link: "/onderwyser/my-terugvoer" });
    revalidatePath("/onderwyser/terugvoer");
    return "Dankie! Jou terugvoer is gestoor en gaan na die ontwikkelaar.";
  });
}

export async function setDevFeedbackStatus(form: FormData) {
  const a = await requireFeedbackReviewer();
  const id = String(form.get("id"));
  const status = String(form.get("status"));
  if (!isOneOf(status, DEV_FEEDBACK_STATUSES)) return;
  const note = cleanText(form.get("devNote"), 2000);
  const reply = cleanText(form.get("developerReply"), 2000);
  const regressionStatus = String(form.get("regressionStatus") ?? "nie");
  const expectedVerdict = String(form.get("expectedVerdict") ?? "");
  await db.devFeedback.updateMany({
    where: { id, schoolId: a.schoolId },
    data: {
      status,
      devNote: note || null,
      developerReply: reply || null,
      respondedAt: reply ? new Date() : null,
      regressionStatus: isOneOf(regressionStatus, REGRESSION_STATUSES) ? regressionStatus : "nie",
      expectedVerdict: isOneOf(expectedVerdict, EXPECTED_VERDICTS) ? expectedVerdict : null
    }
  });
  await logActivity(a, "ontwikkelaar", `Terugvoer-status → ${status}${reply ? ` · antwoord: “${reply.slice(0, 200)}”` : ""}`, { link: "/onderwyser/terugvoer" });
  revalidatePath("/onderwyser/terugvoer");
  revalidatePath("/onderwyser/my-terugvoer");
}

export async function promoteFeedbackToEval(form: FormData) {
  const reviewer = await requireFeedbackReviewer();
  const expectedVerdict = String(form.get("expectedVerdict") ?? "");
  if (!isOneOf(expectedVerdict, ["behaal", "gedeeltelik", "nie_behaal"] as const)) return;
  await createOrUpdateEvalCase({
    schoolId: reviewer.schoolId,
    devFeedbackId: String(form.get("id")),
    createdBy: reviewer.name,
    expectedVerdict,
    notes: cleanText(form.get("devNote"), 2000)
  });
  await logActivity(reviewer, "ontwikkelaar", `KI-toets gemaak uit terugvoer (verwag: ${expectedVerdict})`, { link: "/onderwyser/evaluasies" });
  revalidatePath("/onderwyser/terugvoer");
  revalidatePath("/onderwyser/evaluasies");
}

export async function runEvalCaseAction(form: FormData) {
  const reviewer = await requireFeedbackReviewer();
  await runEvalCase(String(form.get("id")), reviewer.schoolId);
  revalidatePath("/onderwyser/evaluasies");
}

export async function runAllEvalCasesAction() {
  const reviewer = await requireFeedbackReviewer();
  await runActiveEvalCases(reviewer.schoolId);
  revalidatePath("/onderwyser/evaluasies");
}

export async function toggleEvalCase(form: FormData) {
  const reviewer = await requireFeedbackReviewer();
  const id = String(form.get("id"));
  const testCase = await db.aiEvalCase.findFirst({ where: { id, schoolId: reviewer.schoolId }, select: { active: true } });
  if (testCase) {
    await db.aiEvalCase.update({ where: { id }, data: { active: !testCase.active } });
    await logActivity(reviewer, "ontwikkelaar", `KI-toets ${testCase.active ? "gedeaktiveer" : "geaktiveer"}`, { link: "/onderwyser/evaluasies" });
  }
  revalidatePath("/onderwyser/evaluasies");
}

export async function setAiReportStatus(form: FormData) {
  const a = await requireFeedbackReviewer();
  const id = String(form.get("id"));
  const status = String(form.get("status"));
  if (!isOneOf(status, DEV_FEEDBACK_STATUSES)) return;
  const resolution = cleanText(form.get("resolution"), 2000);
  const devNote = cleanText(form.get("devNote"), 2000);
  await db.aiReport.updateMany({
    where: { id, schoolId: a.schoolId },
    data: { status, resolution: resolution || null, devNote: devNote || null, resolvedAt: status === "verwerk" ? new Date() : null }
  });
  await logActivity(a, "ontwikkelaar", `KI-verslag-status → ${status}${resolution ? ` · “${resolution.slice(0, 200)}”` : ""}`, { link: "/onderwyser/terugvoer" });
  revalidatePath("/onderwyser/terugvoer");
}

export async function goToGroupByCode(form: FormData) {
  const t = await requireTeacher();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const g = await db.group.findFirst({ where: { code: { contains: code.replace(/[^A-Z0-9-]/g, "") }, project: { schoolId: t.schoolId } } });
  redirect(g ? `/onderwyser/groep/${g.id}` : "/onderwyser?nie=1");
}
