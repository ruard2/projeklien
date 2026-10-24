// Saamgestelde oorsig van ’n groep se werkboek (vir die groep-tuisblad en onderwyserblaaie).

import type { Checkpoint, Response, SheetStatus } from "@prisma/client";
import { dataHash } from "./hash";
import { canSubmit, cpStatus, sheetAccess, type Access } from "./werkboeke/toegang";
import type { Sheet, SheetData, Template } from "./werkboeke/tipes";
import { completion } from "./werkboeke/volledigheid";
import { cpStates, sheetStatesFor } from "./diens";

export type SheetOverview = {
  key: string;
  sheet: Sheet;
  status: SheetStatus;
  /** Gereed én onveranderd sedert die oordeel */
  ready: boolean;
  progress: number;
  access: Access;
  updatedAt: Date | null;
};

export type CheckpointOverview = {
  number: number;
  title: string;
  statement: string;
  status: Checkpoint["status"];
  record: Checkpoint | null;
  sheets: SheetOverview[];
  canSubmit: boolean;
  reason?: string;
  unlocked: boolean;
};

function asData(v: unknown): SheetData {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as SheetData) : {};
}

export function sheetOverview(sheet: Sheet, key: string, responses: Response[], cps: Checkpoint[], paperImport = false): SheetOverview {
  const r = responses.find((x) => x.sheet === key);
  const data = asData(r?.data);
  const status = r?.status ?? "NOT_STARTED";
  return {
    key,
    sheet,
    status,
    ready: status === "READY" && r?.readyHash === dataHash(data),
    progress: completion(sheet, data),
    access: sheetAccess(sheet, cpStates(cps), { paperImport }),
    updatedAt: r?.updatedAt ?? null
  };
}

export function workbookOverview(t: Template, responses: Response[], cps: Checkpoint[], paperImport = false) {
  const states = cpStates(cps);
  const sheetStates = sheetStatesFor(t, responses);
  const checkpoints: CheckpointOverview[] = t.checkpoints.map((def) => {
    const check = canSubmit(t, def.number, states, sheetStates);
    return {
      number: def.number,
      title: def.title,
      statement: def.statement,
      status: cpStatus(states, def.number),
      record: cps.find((c) => c.number === def.number) ?? null,
      sheets: def.sheets.map((k) => sheetOverview(t.sheets.find((s) => s.key === k)!, k, responses, cps, paperImport)),
      canSubmit: check.ok,
      reason: check.reason,
      unlocked: def.number === 1 || cpStatus(states, def.number - 1) === "APPROVED"
    };
  });
  const approved = checkpoints.filter((c) => c.status === "APPROVED").length;
  const current = checkpoints.find((c) => c.status !== "APPROVED") ?? null;
  return { checkpoints, approved, current };
}
