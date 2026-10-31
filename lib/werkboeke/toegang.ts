// Wie mag wat wanneer wysig? Suiwer funksies (geen databasis), sodat dit oral dieselfde werk.

import type { CheckpointStatus, SheetStatus } from "@prisma/client";
import type { Sheet, Template } from "./tipes";

export type CheckpointState = { number: number; status: CheckpointStatus };

export function cpStatus(cps: CheckpointState[], n: number): CheckpointStatus {
  return cps.find((c) => c.number === n)?.status ?? "OPEN";
}

export type Access = {
  /** Die groep mag die werkblad sien en invul */
  unlocked: boolean;
  /** Die groep mag nou verander */
  editable: boolean;
  reason?: string;
};

export type AccessOpts = {
  /** Groep uit ’n papierwerkboek: afgetekende werkblaaie mag nog verbeter word. */
  paperImport?: boolean;
  /** Hoogste kontrolepunt wat oop is (sien progress()); sonder dit geld net aftekening. */
  unlockedUpTo?: number;
};

export function sheetAccess(sheet: Sheet, cps: CheckpointState[], opts: AccessOpts = {}): Access {
  const n = sheet.checkpoint;
  if (n === null) return { unlocked: true, editable: true };
  const open = opts.unlockedUpTo !== undefined ? n <= opts.unlockedUpTo : n === 1 || cpStatus(cps, n - 1) === "APPROVED";
  if (!open) {
    return {
      unlocked: false,
      editable: false,
      reason: `Hierdie werkblad gaan oop sodra kontrolepunt ${n - 1} klaar is: al sy werkblaaie gereed volgens die KI, of afgeteken deur die onderwyser.`
    };
  }
  const own = cpStatus(cps, n);
  if (own === "APPROVED" && opts.paperImport) return { unlocked: true, editable: true, reason: `Kontrolepunt ${n} is op papier afgeteken. Julle mag hierdie werkblad nog verbeter.` };
  if (own === "APPROVED") return { unlocked: true, editable: false, reason: `Kontrolepunt ${n} is afgeteken. Hierdie werkblad kan nie meer verander word nie.` };
  if (own === "SUBMITTED") return { unlocked: true, editable: false, reason: `Ingedien vir kontrolepunt ${n}. Wag vir die onderwyser.` };
  return { unlocked: true, editable: true };
}

export function checkpointSheets(t: Template, n: number): Sheet[] {
  const def = t.checkpoints.find((c) => c.number === n);
  return def ? def.sheets.map((k) => t.sheets.find((s) => s.key === k)!).filter(Boolean) : [];
}

export type SheetState = { sheet: string; status: SheetStatus; readyHash: string | null; currentHash: string; started?: boolean };

const isReadyState = (st: SheetState | undefined) => Boolean(st && st.status === "READY" && st.readyHash === st.currentHash);

/** Al die werkblaaie van kontrolepunt n is gereed (deur die KI of die onderwyser) vir die huidige weergawe. */
export function checkpointSatisfied(t: Template, n: number, states: SheetState[]): boolean {
  const sheets = checkpointSheets(t, n);
  return sheets.length > 0 && sheets.every((s) => isReadyState(states.find((x) => x.sheet === s.key)));
}

/**
 * Hoe ver mag die groep werk? Kontrolepunt n gaan oop as n−1 afgeteken is óf al sy werkblaaie gereed is
 * (die KI is tevrede). ’n Kontrolepunt waaraan die groep al begin werk het, bly oop, ook as hulle later
 * vroeëre werk verander.
 */
export function progress(t: Template, cps: CheckpointState[], states: SheetState[]): { unlockedUpTo: number } {
  let chain = 1;
  for (const cp of t.checkpoints) {
    if (cp.number <= 1) continue;
    const prev = cp.number - 1;
    if (cpStatus(cps, prev) === "APPROVED" || checkpointSatisfied(t, prev, states)) chain = cp.number;
    else break;
  }
  let started = 0;
  for (const cp of t.checkpoints) {
    if (checkpointSheets(t, cp.number).some((s) => states.find((x) => x.sheet === s.key)?.started)) started = Math.max(started, cp.number);
    if (cpStatus(cps, cp.number) !== "OPEN" && cpStatus(cps, cp.number) !== "RETURNED") started = Math.max(started, cp.number);
  }
  return { unlockedUpTo: Math.max(chain, started) };
}

/** Mag die groep hierdie kontrolepunt nou vir aftekening indien? */
export function canSubmit(t: Template, n: number, cps: CheckpointState[], states: SheetState[]): { ok: boolean; reason?: string } {
  const status = cpStatus(cps, n);
  if (status === "APPROVED") return { ok: false, reason: "Reeds afgeteken." };
  if (status === "SUBMITTED") return { ok: false, reason: "Reeds ingedien." };
  if (n > progress(t, cps, states).unlockedUpTo) return { ok: false, reason: `Kontrolepunt ${n - 1} moet eers klaar wees.` };
  const notReady = checkpointSheets(t, n).filter((s) => !isReadyState(states.find((x) => x.sheet === s.key)));
  if (notReady.length) {
    return { ok: false, reason: `Nog nie gereed nie: ${notReady.map((s) => `werkblad ${s.number}`).join(", ")}.` };
  }
  return { ok: true };
}

export const STATUS_LABEL: Record<SheetStatus, string> = {
  NOT_STARTED: "Nog nie begin nie",
  IN_PROGRESS: "Nog nie gereed nie",
  NOT_READY: "Nog nie gereed nie",
  READY: "Gereed vir onderwyser"
};

export const CP_LABEL: Record<CheckpointStatus, string> = {
  OPEN: "Oop",
  SUBMITTED: "Wag vir aftekening",
  APPROVED: "Afgeteken",
  RETURNED: "Terug na groep"
};
