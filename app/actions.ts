"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { normaliseCode } from "@/lib/kodes";
import { clearGroupSession, clearTeacherSession, setGroupSession, setTeacherSession } from "@/lib/sessie";
import { allow } from "@/lib/tempo";
import { verifyPassword } from "@/lib/wagwoord";
import { logActivity } from "@/lib/aktiwiteit";

export type FormState = { error?: string } | undefined;

async function clientKey() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "onbekend";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function groupLogin(_prev: FormState, form: FormData): Promise<FormState> {
  const code = normaliseCode(String(form.get("code") ?? ""));
  if (code.length < 6) return { error: "Tik julle groepkode in." };
  if (!(await allow(`login:${await clientKey()}`, 20, 600))) return { error: "Te veel pogings. Wag ’n paar minute en probeer weer." };
  const group = await db.group.findUnique({ where: { code }, include: { project: true } });
  if (!group || group.archived || !group.project.active) return { error: "Hierdie kode is nie bekend nie. Kyk mooi of vra julle onderwyser." };
  await db.group.update({ where: { id: group.id }, data: { lastSeenAt: new Date() } });
  await setGroupSession(group.id);
  redirect("/groep");
}

export async function groupLogout() {
  await clearGroupSession();
  redirect("/");
}

export async function teacherLogin(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Vul jou e-pos en wagwoord in." };
  if (!(await allow(`tlogin:${await clientKey()}`, 10, 600))) return { error: "Te veel pogings. Wag ’n paar minute en probeer weer." };
  const t = await db.teacher.findUnique({ where: { email } });
  if (!t || !t.active || !(await verifyPassword(password, t.passwordHash))) return { error: "E-pos of wagwoord is nie korrek nie." };
  await db.teacher.update({ where: { id: t.id }, data: { lastLoginAt: new Date() } });
  await setTeacherSession(t.id);
  await logActivity(t, "aanmeld", "Aangemeld");
  redirect("/onderwyser");
}

export async function teacherLogout() {
  await clearTeacherSession();
  redirect("/onderwyser/aanmeld");
}
