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
};

export function sheetAccess(sheet: Sheet, cps: CheckpointState[], opts: AccessOpts = {}): Access {
  const n = sheet.checkpoint;
  if (n === null) return { unlocked: true, editable: true };
  if (n > 1 && cpStatus(cps, n - 1) !== "APPROVED") {
    return {
      unlocked: false,
      editable: false,
      reason: `Hierdie werkblad gaan oop sodra kontrolepunt ${n - 1} afgeteken is.`
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

export type SheetState = { sheet: string; status: SheetStatus; readyHash: string | null; currentHash: string };

/** Mag die groep hierdie kontrolepunt nou indien? */
export function canSubmit(t: Template, n: number, cps: CheckpointState[], states: SheetState[]): { ok: boolean; reason?: string } {
  const status = cpStatus(cps, n);
  if (status === "APPROVED") return { ok: false, reason: "Reeds afgeteken." };
  if (status === "SUBMITTED") return { ok: false, reason: "Reeds ingedien." };
  if (n > 1 && cpStatus(cps, n - 1) !== "APPROVED") return { ok: false, reason: `Kontrolepunt ${n - 1} moet eers afgeteken word.` };
  const notReady = checkpointSheets(t, n).filter((s) => {
    const st = states.find((x) => x.sheet === s.key);
    return !st || st.status !== "READY" || st.readyHash !== st.currentHash;
  });
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
