// Skakel ’n werkblad se data om na leesbare teks (vir die KI en vir uitvoer).
// Met { anonymise: true } word lede se name vervang met "Lid 1" ens., en
// e-posadresse, telefoonnommers en ID-nommers verwyder. Foto’s word nooit gestuur nie.

import type { Column, Field, RowValue, Sheet, SheetData } from "./tipes";
import { asKeyed, asList, asRows, isBlank } from "./volledigheid";

export type TextOptions = { members: string[]; anonymise: boolean; photoCounts?: Record<string, number> };

/**
 * Die presiese opdrag en steunmateriaal wat saam met die leerder se antwoord
 * na die KI gaan. Dit voorkom dat die KI net die ingevulde velde sien, maar
 * nie die werkboek se bedoeling, voorbeelde en hulpteks nie.
 */
export function sheetInstructionText(sheet: Sheet): string {
  const out: string[] = [];
  if (sheet.intro) out.push(sheet.intro);
  for (const section of sheet.sections) {
    if (section.title) out.push(`## ${section.title}`);
    if (section.intro) out.push(section.intro);
    for (const field of section.fields) {
      if (field.type === "info") {
        if (field.title) out.push(field.title);
        out.push(...field.body);
        if (field.examples?.length) {
          out.push(...field.examples.map((e) => `${e.label}: ${e.text}`));
        }
        continue;
      }
      if (field.label) out.push(field.label);
      if (field.help) out.push(`Hulp: ${field.help}`);
      if (field.type === "table") {
        out.push(`Kolomme: ${[field.rowHeader, ...field.columns.map((c) => c.label)].filter(Boolean).join(" | ")}`);
        if (field.rows?.length) out.push(`Vaste rye: ${field.rows.map((r) => r.label).join("; ")}`);
      } else if (field.type === "matrix") {
        out.push(`Vrae: ${field.rows.map((r) => r.label).join("; ")}`);
        out.push(`Gee elke idee ’n punt van ${field.min} tot ${field.max}.`);
      } else if (field.type === "entries") {
        out.push(`Elke ${field.entryLabel.toLowerCase()} bevat: ${field.fields.map((f) => f.label).join("; ")}.`);
      }
    }
  }
  return out.join("\n").trim();
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redact(text: string, members: string[]): string {
  let out = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[e-pos verwyder]")
    .replace(/\b\d{13}\b/g, "[ID-nommer verwyder]")
    .replace(/(\+27|\b0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[telefoonnommer verwyder]");
  members.forEach((name, i) => {
    const n = name.trim();
    if (n.length < 2) return;
    out = out.replace(new RegExp(`(?<![\\p{L}])${escapeRegex(n)}(?![\\p{L}])`, "giu"), `Lid ${i + 1}`);
  });
  return out;
}

function memberLabel(v: unknown, o: TextOptions): string {
  const i = Number(v);
  if (!i) return "";
  if (o.anonymise) return `Lid ${i}`;
  return o.members[i - 1]?.trim() || `Lid ${i}`;
}

function cell(c: Column, row: RowValue | undefined, o: TextOptions): string {
  if (!row) return "";
  const v = row[c.key];
  if (c.kind === "check") return v ? "✓" : "—";
  if (c.kind === "member") return memberLabel(v, o);
  if (isBlank(v)) return "";
  return clean(String(v), o);
}

function clean(s: string, o: TextOptions) {
  const t = s.trim();
  return o.anonymise ? redact(t, o.members) : t;
}

function fieldText(field: Field, value: unknown, o: TextOptions): string {
  switch (field.type) {
    case "text":
    case "textarea":
      return isBlank(value) ? "(leeg)" : clean(String(value), o);
    case "choice":
      return isBlank(value) ? "(nie gekies nie)" : String(value);
    case "list":
      return asList(value)
        .slice(0, field.count)
        .map((x, i) => `${i + 1}. ${x.trim() ? clean(x, o) : "(leeg)"}`)
        .join("\n");
    case "table": {
      const cols = field.columns;
      if (field.rows) {
        const data = asKeyed(value);
        return field.rows
          .map((r) => {
            const parts = cols.map((c) => `${c.label}: ${c.kind === "static" ? r.cells?.[c.key] ?? "" : cell(c, data[r.key], o) || "(leeg)"}`);
            return `- ${r.label} | ${parts.join(" | ")}`;
          })
          .join("\n");
      }
      const rows = asRows(value).filter((r) => cols.some((c) => !isBlank(r[c.key])));
      if (!rows.length) return "(geen rye nie)";
      let text = rows.map((r, i) => `${i + 1}. ${cols.map((c) => `${c.label}: ${cell(c, r, o) || "(leeg)"}`).join(" | ")}`).join("\n");
      if (field.total) {
        const sum = rows.reduce((a, r) => a + (Number(String(r[field.total!.column] ?? "").replace(",", ".")) || 0), 0);
        text += `\n${field.total.label}: R${sum.toFixed(2)}`;
      }
      return text;
    }
    case "matrix": {
      const data = asKeyed(value);
      const lines = field.rows.map((r) => `- ${r.label} | ${field.cols.map((c) => `${c.label}: ${data[r.key]?.[c.key] ?? "–"}`).join(" | ")}`);
      const totals = field.cols.map((c) => `${c.label}: ${field.rows.reduce((a, r) => a + (Number(data[r.key]?.[c.key]) || 0), 0)}`);
      return `${lines.join("\n")}\n${field.totalLabel}: ${totals.join(" | ")}`;
    }
    case "entries": {
      const entries = asRows(value);
      if (!entries.length) return "(geen inskrywings nie)";
      return entries
        .map((e, i) => `${field.entryLabel} ${i + 1}:\n${field.fields.map((c) => `  ${c.label}: ${cell(c, e, o) || "(leeg)"}`).join("\n")}`)
        .join("\n");
    }
    case "photos": {
      const n = o.photoCounts?.[field.key] ?? 0;
      return n ? `[${n} foto(’s) opgelaai – foto’s word nie gedeel nie]` : "[geen foto’s nie]";
    }
    default:
      return "";
  }
}

export function sheetToText(sheet: Sheet, data: SheetData, o: TextOptions): string {
  const out: string[] = [];
  for (const section of sheet.sections) {
    const fields = section.fields.filter((f) => f.type !== "info" && f.type !== "teacherNote");
    if (!fields.length) continue;
    if (section.title) out.push(`## ${section.title}`);
    for (const f of fields) {
      if (f.label) out.push(`${f.label}:`);
      out.push(fieldText(f, data[f.key], o));
    }
    out.push("");
  }
  return out.join("\n").trim();
}
