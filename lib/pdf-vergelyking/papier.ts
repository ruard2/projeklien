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

