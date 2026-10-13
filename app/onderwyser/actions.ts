"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decideCheckpoint, DiensFout, reopenCheckpoint, saveTeacherNote, teacherMarkReady } from "@/lib/diens";
import { newGroupCode } from "@/lib/kodes";
import { requireAdmin, requireTeacher } from "@/lib/sessie";
import { getTemplate, listTemplates } from "@/lib/werkboeke/sjablone";
import { hashPassword } from "@/lib/wagwoord";

export type ActionState = { error?: string; ok?: string } | undefined;

async function ownGroup(groupId: string) {
  const t = await requireTeacher();
  const g = await db.group.findUnique({ where: { id: groupId }, include: { project: true } });
  if (!g || g.project.schoolId !== t.schoolId) throw new DiensFout("Groep nie gevind nie.", 404);
  return { t, g };
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
    const { t } = await ownGroup(groupId);
    await decideCheckpoint({ id: t.id, name: t.name }, groupId, n, decision, comment);
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
    const { t } = await ownGroup(groupId);
    await reopenCheckpoint({ id: t.id, name: t.name }, groupId, n, comment || "Heropen deur die onderwyser.");
    revalidatePath(`/onderwyser/groep/${groupId}`);
    return `Kontrolepunt ${n} is weer oop vir die groep.`;
  });
}

export async function markReady(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const groupId = String(form.get("groupId"));
    const sheet = String(form.get("sheet"));
    const { t } = await ownGroup(groupId);
    await teacherMarkReady({ name: t.name }, groupId, sheet);
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
    const { t } = await ownGroup(groupId);
    await saveTeacherNote({ name: t.name }, groupId, sheet, field, text);
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
    revalidatePath("/onderwyser/groepe");
    revalidatePath("/onderwyser");
    return `${made} nuwe groepkode(s) geskep.`;
  });
}

export async function archiveGroup(form: FormData) {
  const { g } = await ownGroup(String(form.get("groupId")));
  await db.group.update({ where: { id: g.id }, data: { archived: !g.archived } });
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
    revalidatePath("/onderwyser/beheer");
    return "Projek geskep.";
  });
}

export async function toggleProject(form: FormData) {
  const a = await requireAdmin();
  const p = await db.project.findFirst({ where: { id: String(form.get("projectId")), schoolId: a.schoolId } });
  if (p) await db.project.update({ where: { id: p.id }, data: { active: !p.active } });
  revalidatePath("/onderwyser/beheer");
}

export async function createTeacher(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const a = await requireAdmin();
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const role = form.get("role") === "ADMIN" ? "ADMIN" : "TEACHER";
    if (!name || !email.includes("@")) throw new DiensFout("Vul ’n naam en geldige e-pos in.");
    if (password.length < 8) throw new DiensFout("Die wagwoord moet minstens 8 karakters wees.");
    if (await db.teacher.findUnique({ where: { email } })) throw new DiensFout("Daar is reeds ’n onderwyser met hierdie e-pos.");
    await db.teacher.create({ data: { schoolId: a.schoolId, name, email, role, passwordHash: await hashPassword(password) } });
    revalidatePath("/onderwyser/beheer");
    return `${name} is bygevoeg.`;
  });
}

export async function toggleTeacher(form: FormData) {
  const a = await requireAdmin();
  const t = await db.teacher.findFirst({ where: { id: String(form.get("teacherId")), schoolId: a.schoolId } });
  if (t && t.id !== a.id) await db.teacher.update({ where: { id: t.id }, data: { active: !t.active } });
  revalidatePath("/onderwyser/beheer");
}

export async function changeOwnPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  return attempt(async () => {
    const t = await requireTeacher();
    const pw = String(form.get("password") ?? "");
    if (pw.length < 8) throw new DiensFout("Minstens 8 karakters.");
    await db.teacher.update({ where: { id: t.id }, data: { passwordHash: await hashPassword(pw) } });
    return "Wagwoord verander.";
  });
}

export async function goToGroupByCode(form: FormData) {
  const t = await requireTeacher();
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const g = await db.group.findFirst({ where: { code: { contains: code.replace(/[^A-Z0-9-]/g, "") }, project: { schoolId: t.schoolId } } });
  redirect(g ? `/onderwyser/groep/${g.id}` : "/onderwyser?nie=1");
}
