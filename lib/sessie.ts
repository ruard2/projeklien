import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import type { TeacherRole } from "@prisma/client";

// Staatlose, ondertekende sessie-koekies: enige aantal bediener-instansies kan dit verifieer.

const GROUP_COOKIE = "vol_groep";
const TEACHER_COOKIE = "vol_onderwyser";
const GROUP_MAX_AGE = 60 * 60 * 24 * 60; // 60 dae – groepe werk ook van die huis af
const TEACHER_MAX_AGE = 60 * 60 * 12; // 12 uur

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET moet gestel wees (minstens 32 karakters).");
    return "ontwikkeling-slegs-nie-vir-produksie-nie-0123456789";
  }
  return s;
}

function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

// ---------------------------------------------------------------- Groep

export async function setGroupSession(groupId: string) {
  const jar = await cookies();
  jar.set(GROUP_COOKIE, sign({ g: groupId, exp: Math.floor(Date.now() / 1000) + GROUP_MAX_AGE }), {
    ...cookieBase,
    maxAge: GROUP_MAX_AGE
  });
}

export async function clearGroupSession() {
  (await cookies()).delete(GROUP_COOKIE);
}

export async function currentGroupId(): Promise<string | null> {
  const p = verify<{ g: string }>((await cookies()).get(GROUP_COOKIE)?.value);
  return p?.g ?? null;
}

export async function currentGroup() {
  const id = await currentGroupId();
  if (!id) return null;
  const group = await db.group.findUnique({ where: { id }, include: { project: { include: { school: true } } } });
  if (!group || group.archived || !group.project.active) return null;
  return group;
}

export async function requireGroup() {
  const g = await currentGroup();
  if (!g) redirect("/");
  return g;
}

// ---------------------------------------------------------------- Onderwyser

export async function setTeacherSession(teacherId: string) {
  const jar = await cookies();
  jar.set(TEACHER_COOKIE, sign({ t: teacherId, exp: Math.floor(Date.now() / 1000) + TEACHER_MAX_AGE }), {
    ...cookieBase,
    maxAge: TEACHER_MAX_AGE
  });
}

export async function clearTeacherSession() {
  (await cookies()).delete(TEACHER_COOKIE);
}

export async function currentTeacher() {
  const p = verify<{ t: string }>((await cookies()).get(TEACHER_COOKIE)?.value);
  if (!p) return null;
  const t = await db.teacher.findUnique({ where: { id: p.t }, include: { school: true } });
  if (!t || !t.active) return null;
  return t;
}

export async function requireTeacher() {
  const t = await currentTeacher();
  if (!t) redirect("/onderwyser/aanmeld");
  return t;
}

export async function requireAdmin() {
  const t = await requireTeacher();
  if (!isAdminRole(t.role)) redirect("/onderwyser");
  return t;
}

export function isAdminRole(role: TeacherRole): boolean {
  return role === "ADMIN" || role === "DEVELOPER";
}

export function canReviewFeedback(role: TeacherRole): boolean {
  return role === "DEVELOPER" || role === "ADMIN";
}

export async function requireFeedbackReviewer() {
  const t = await requireTeacher();
  if (!canReviewFeedback(t.role)) redirect("/onderwyser/my-terugvoer");
  return t;
}

/**
 * Sien hierdie gebruiker die ontwikkelaarsfunksies (🧪)? Altyd vir die rol Ontwikkelaar. Solank die skool nog
 * geen ontwikkelaarsrekening het nie, ook vir administrateurs (oorgang, sodat niks onbereikbaar raak nie).
 */
export async function hasDeveloperView(t: { role: TeacherRole; schoolId: string }): Promise<boolean> {
  if (t.role === "DEVELOPER") return true;
  if (t.role !== "ADMIN") return false;
  return (await db.teacher.count({ where: { schoolId: t.schoolId, role: "DEVELOPER", active: true } })) === 0;
}

export async function requireDeveloper() {
  const t = await requireTeacher();
  if (!(await hasDeveloperView(t))) redirect("/onderwyser");
  return t;
}
