// Deterministiese volledigheidstoets: dieselfde vir elke groep, voordat die KI gevra word.

import type { Column, Field, RowValue, Sheet, SheetData } from "./tipes";

export function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "boolean") return !v;
  if (typeof v === "number") return Number.isNaN(v);
  return false;
}

const editable = (c: Column) => c.kind !== "static";
const counts = (c: Column) => editable(c) && c.kind !== "check" && !c.optional;

function rowHasContent(row: RowValue | undefined, cols: Column[]): boolean {
  if (!row) return false;
  return cols.filter(editable).some((c) => !isBlank(row[c.key]));
}

function rowComplete(row: RowValue | undefined, cols: Column[]): boolean {
  if (!row) return false;
  const required = cols.filter(counts);
  if (required.length === 0) return cols.filter(editable).some((c) => !isBlank(row[c.key]));
  return required.every((c) => !isBlank(row[c.key]));
}

export function asRows(v: unknown): RowValue[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as RowValue[]) : [];
}

export function asKeyed(v: unknown): Record<string, RowValue> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, RowValue>) : {};
}

export function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : "")) : [];
}

/** Gee ’n boodskap terug as die veld nog nie volledig is nie, anders null. */
export function fieldProblem(field: Field, value: unknown): string | null {
  if (!field.required) return null;
  switch (field.type) {
    case "text":
    case "textarea":
    case "choice":
      return isBlank(value) ? "is nog leeg" : null;
    case "list": {
      const filled = asList(value).filter((x) => x.trim()).length;
      const need = field.minFilled ?? field.count;
      return filled < need ? `het ${filled} van ${need} ingevul` : null;
    }
    case "table": {
      if (field.rows) {
        const data = asKeyed(value);
        if (field.requireAllRows) {
          const missing = field.rows.filter((r) => !rowComplete(data[r.key], field.columns));
          return missing.length ? `nog nie volledig nie: ${missing.map((r) => r.label).join(", ")}` : null;
        }
        return field.rows.some((r) => rowHasContent(data[r.key], field.columns)) ? null : "is nog leeg";
      }
      const rows = asRows(value).filter((r) => rowHasContent(r, field.columns));
      const need = field.minRows ?? 1;
      if (rows.length < need) return `het ${rows.length} ry(e); minstens ${need} nodig`;
      const incomplete = rows.filter((r) => !rowComplete(r, field.columns)).length;
      return incomplete ? `${incomplete} ry(e) is nog nie heeltemal ingevul nie` : null;
    }
    case "matrix": {
      const data = asKeyed(value);
      const missing = field.rows.some((r) => field.cols.some((c) => isBlank(data[r.key]?.[c.key])));
      return missing ? "nog nie elke punt is ingevul nie" : null;
    }
    case "entries": {
      const entries = asRows(value).filter((e) => rowHasContent(e, field.fields));
      const need = field.minEntries ?? 1;
      if (entries.length < need) return `het ${entries.length} inskrywing(s); minstens ${need} nodig`;
      const incomplete = entries.filter((e) => !rowComplete(e, field.fields)).length;
      return incomplete ? `${incomplete} inskrywing(s) is nog nie volledig nie` : null;
    }
    default:
      return null;
  }
}

export function fieldTitle(sheet: Sheet, field: Field): string {
  if (field.label) return field.label;
  if (field.title) return field.title;
  const section = sheet.sections.find((s) => s.fields.includes(field));
  return section?.title ?? sheet.title;
}

export type Missing = { key: string; title: string; problem: string };

export function missingFields(sheet: Sheet, data: SheetData): Missing[] {
  const out: Missing[] = [];
  for (const section of sheet.sections) {
    for (const field of section.fields) {
      const problem = fieldProblem(field, data[field.key]);
      if (problem) out.push({ key: field.key, title: fieldTitle(sheet, field), problem });
    }
  }
  return out;
}

/** Ruwe vordering 0–1, vir die dashboard. */
export function completion(sheet: Sheet, data: SheetData): number {
  const required = sheet.sections.flatMap((s) => s.fields).filter((f) => f.required);
  if (!required.length) return Object.values(data).some((v) => !isBlank(v)) ? 1 : 0;
  const ok = required.filter((f) => !fieldProblem(f, data[f.key])).length;
  return ok / required.length;
}
