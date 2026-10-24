// Suiwer hulpfunksies vir papierwerkboek → digitale groep (geen databasis).

import { getTemplate } from "../werkboeke/sjablone";
import type { Extracted } from "./skema";

export const PAPER_NOTE = "_papier";

/** Voorletters van die lede se voorname, bv. "IAWD". */
export function initials(members: string[]): string {
  return members
    .map((m) => m.trim().match(/\p{L}/u)?.[0]?.toUpperCase() ?? "")
    .join("");
}

/** Eie groepnaam van die papier as daar een is, anders die voorletters. */
export function paperGroupName(e: Pick<Extracted, "groepnaam" | "lede">): string {
  return (e.groepnaam.trim() || initials(e.lede) || "Groep").slice(0, 60);
}

/** Watter kontrolepunte is op papier afgeteken? (Alle werkblaaie teenwoordig en een afgeteken.) */
export function paperApprovedCheckpoints(templateKey: string, e: Extracted): number[] {
  const t = getTemplate(templateKey);
  const out: number[] = [];
  for (const cp of t.checkpoints) {
    const present = cp.sheets.every((k) => e.sheets[k]);
    const signed = cp.sheets.some((k) => e.sheets[k]?.juf.afgeteken);
    if (!present || !signed) break; // kontrolepunte volg op mekaar
    out.push(cp.number);
  }
  return out;
}


/** Dieselfde groep (werkboek + lede se voorname), ongeag hoe dikwels dit opgelaai is. */
export function paperIdentity(templateKey: string, e: Pick<Extracted, "lede">): string {
  const firsts = e.lede.map((m) => m.trim().split(/\s+/)[0]?.toLowerCase().normalize("NFD").replace(/[^\p{L}]/gu, "") ?? "").filter(Boolean).sort();
  return `${templateKey}|${firsts.join(",")}`;
}

export type PaperCandidate = { id: string; templateKey: string; status: string; model: string | null; createdAt: Date; groupId: string | null; extracted: unknown };

/**
 * Kies een vergelyking per groep om ’n digitale werkboek van te maak: die handmatig
 * oorgeskrewe invoer wen, anders die nuutste. Groepe wat reeds ’n werkboek het, val weg.
 */
export function pickPaperCandidates(items: PaperCandidate[], madeIds: Set<string>) {
  const usable = (c: PaperCandidate) => Boolean(c.extracted) && ["nagaan", "ki", "klaar"].includes(c.status);
  const done = new Set(items.filter((c) => c.groupId && madeIds.has(c.groupId) && c.extracted).map((c) => paperIdentity(c.templateKey, c.extracted as Extracted)));
  const best = new Map<string, PaperCandidate>();
  let duplicates = 0;
  for (const c of items) {
    if (c.groupId || !usable(c)) continue;
    const key = paperIdentity(c.templateKey, c.extracted as Extracted);
    if (done.has(key)) { duplicates++; continue; }
    const prev = best.get(key);
    if (!prev) { best.set(key, c); continue; }
    duplicates++;
    const score = (x: PaperCandidate) => [x.model?.startsWith("handmatig") ? 1 : 0, x.createdAt.getTime()];
    const [a1, a2] = score(c), [b1, b2] = score(prev);
    if (a1 > b1 || (a1 === b1 && a2 > b2)) best.set(key, c);
  }
  return { picks: [...best.values()], duplicates };
}
