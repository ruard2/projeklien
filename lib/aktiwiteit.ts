// Ouditlog van onderwyserhandelinge. Faal nooit hard nie: die handeling self is belangriker.

import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type ActivityType =
  | "aanmeld"
  | "kontrolepunt"
  | "gereed"
  | "kommentaar"
  | "groepe"
  | "bestuur"
  | "rekening"
  | "terugvoer"
  | "pdf"
  | "duim"
  | "ontwikkelaar";

export const ACTIVITY_LABEL: Record<string, string> = {
  aanmeld: "Aangemeld",
  kontrolepunt: "Kontrolepunt",
  gereed: "Gereed gemerk",
  kommentaar: "Kommentaar",
  groepe: "Groepe",
  bestuur: "Bestuur",
  rekening: "Rekening",
  terugvoer: "Terugvoer",
  pdf: "PDF-vergelyking",
  duim: "Duimpie / gesprek",
  ontwikkelaar: "Ontwikkelaar",
  reel: "KI-reël"
};

export async function logActivity(
  t: { id: string; name: string; schoolId: string },
  type: ActivityType,
  summary: string,
  extra?: { link?: string; details?: unknown }
) {
  try {
    await db.teacherActivity.create({
      data: {
        schoolId: t.schoolId,
        teacherId: t.id,
        teacherName: t.name,
        type,
        summary: summary.slice(0, 1000),
        link: extra?.link ?? null,
        details: extra?.details === undefined ? undefined : (JSON.parse(JSON.stringify(extra.details)) as Prisma.InputJsonValue)
      }
    });
  } catch (e) {
    console.error("[aktiwiteit]", e);
  }
}
