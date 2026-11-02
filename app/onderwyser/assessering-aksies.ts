"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/aktiwiteit";
import { saveMark } from "@/lib/assessering/diens";
import { DiensFout } from "@/lib/diens";
import { requireTeacher } from "@/lib/sessie";

export type MarkState = { error?: string; ok?: string } | undefined;

export async function saveMarkAction(_prev: MarkState, form: FormData): Promise<MarkState> {
  const t = await requireTeacher();
  const groupId = String(form.get("groupId"));
  const finalise = form.get("aksie") === "finaal";
  try {
    const out = await saveMark(t, groupId, {
      scores: Object.fromEntries(form.entries()),
      comment: String(form.get("comment") ?? ""),
      assessors: String(form.get("assessors") ?? ""),
      assessmentId: String(form.get("assessmentId") ?? "") || null,
      finalise
    });
    await logActivity(t, "assessering", `${finalise ? "Finale punt" : "Konsep-punt"} vir ${out.groupName}: ${out.total}/50`, { link: `/onderwyser/assessering/${groupId}` });
    revalidatePath(`/onderwyser/assessering/${groupId}`);
    revalidatePath("/onderwyser/assessering");
    return { ok: finalise ? `Finale punt gestoor: ${out.total}/50.` : `Konsep gestoor: ${out.total}/50.` };
  } catch (e) {
    if (e instanceof DiensFout) return { error: e.message };
    console.error("[assessering]", e);
    return { error: "Kon nie stoor nie. Probeer weer." };
  }
}
