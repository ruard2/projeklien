"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loadOwnComparison, runExtraction, runFeedback, STALE_MS } from "@/lib/pdf-vergelyking/diens";
import { requireTeacher } from "@/lib/sessie";

const path = (id: string) => `/onderwyser/pdf-vergelyking/${id}`;

export async function approveExtraction(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  if (c.status !== "nagaan") redirect(path(c.id));
  // Die PDF (met name) word nie langer as nodig gehou nie.
  await db.pdfComparison.update({ where: { id: c.id }, data: { status: "ki", pdf: null, error: null } });
  after(() => runFeedback(c.id));
  redirect(path(c.id));
}

export async function retryComparison(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  const busy = (c.status === "uitlees" || c.status === "ki") && Date.now() - c.updatedAt.getTime() < STALE_MS;
  if (busy) redirect(path(c.id));
  if (c.pdf && (c.status === "nagaan" || c.status === "fout" || c.status === "uitlees")) {
    await db.pdfComparison.update({ where: { id: c.id }, data: { status: "uitlees", error: null } });
    after(() => runExtraction(c.id));
  } else if (c.extracted) {
    await db.pdfComparison.update({ where: { id: c.id }, data: { status: "ki", error: null } });
    after(() => runFeedback(c.id));
  }
  redirect(path(c.id));
}

export async function deleteComparison(form: FormData) {
  const t = await requireTeacher();
  const c = await loadOwnComparison(String(form.get("id")), t);
  await db.pdfComparison.delete({ where: { id: c.id } });
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
