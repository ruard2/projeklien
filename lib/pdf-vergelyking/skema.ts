// Bou ’n streng JSON-skema uit ’n werkboeksjabloon, sodat OpenAI die gescande
// papierwerkboek direk op die app se velde kan uitlees, en skakel die uitslag
// terug na gewone werkblad-data (SheetData).

import { redact } from "../werkboeke/teks";
import type { Column, Field, Sheet, SheetData, Template } from "../werkboeke/tipes";

type Json = Record<string, unknown>;

export type JufKommentaar = {
  kommentaar: string[];
  kommentaar_vorige: string[];
  afgeteken: boolean;
  afteken_datum: string;
};

export type ExtractedSheet = {
  data: SheetData;
  foto: boolean;
  juf: JufKommentaar;
  onseker: string[];
};

export type Extracted = {
  groepnaam: string;
  klas: string;
  lede: string[];
  sheets: Record<string, ExtractedSheet>;
};

const str = (description?: string): Json => (description ? { type: "string", description } : { type: "string" });

function obj(properties: Record<string, Json>, description?: string): Json {
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties, ...(description ? { description } : {}) };
}

/** Werkblaaie wat uit ’n papierwerkboek gelees word (nie per-lid of die voorblad nie). */
export function extractableSheets(t: Template): Sheet[] {
  return t.sheets.filter((s) => s.number !== null && !s.perMember);
}

const studentFields = (s: Sheet): Field[] =>
  s.sections.flatMap((sec) => sec.fields).filter((f) => f.type !== "info" && f.type !== "teacherNote");

function columnSchema(c: Column): Json {
  if (c.kind === "check") return { type: "boolean", description: c.label };
  if (c.kind === "select") return { type: "string", enum: ["", ...(c.options ?? [])], description: `${c.label} (kies die naaste opsie)` };
  if (c.kind === "member") return str(`${c.label}: die naam van die groeplid soos geskryf`);
  if (c.kind === "currency" || c.kind === "number") return str(`${c.label}: net die getal, sonder R (Verniet = 0)`);
  return str(c.label);
}

const editableColumns = (cols: Column[]) => cols.filter((c) => c.kind !== "static");

function fieldSchema(f: Field): Json | null {
  const label = f.label ?? f.title ?? f.key;
  switch (f.type) {
    case "text":
    case "textarea":
      return str(label);
    case "choice":
      return { type: "string", enum: ["", ...f.options.map((o) => o.value)], description: label };
    case "list":
      return { type: "array", items: { type: "string" }, description: `${label} (hoogstens ${f.count} items, een per reël/nommer)` };
    case "table": {
      const cols = Object.fromEntries(editableColumns(f.columns).map((c) => [c.key, columnSchema(c)]));
      if (f.rows?.length) return obj(Object.fromEntries(f.rows.map((r) => [r.key, obj(cols, r.label)])), label);
      return { type: "array", items: obj(cols), description: `${label}: een item per ingevulde ry, leë rye weglaat` };
    }
    case "matrix": {
      const cols = Object.fromEntries(f.cols.map((c) => [c.key, { type: ["integer", "null"], description: c.label }]));
      return obj(Object.fromEntries(f.rows.map((r) => [r.key, obj(cols, r.label)])), `${label}: punte ${f.min}–${f.max}, null as leeg`);
    }
    case "entries": {
      const cols = Object.fromEntries(editableColumns(f.fields).map((c) => [c.key, columnSchema(c)]));
      return { type: "array", items: obj(cols), description: `${f.entryLabel}: een item per inskrywing` };
    }
    case "photos":
      return { type: "boolean", description: `${label}: is daar ’n tekening, foto of skets op die bladsy?` };
    default:
      return null;
  }
}

function sheetSchema(s: Sheet): Json {
  const answers: Record<string, Json> = {};
  for (const f of studentFields(s)) {
    const schema = fieldSchema(f);
    if (schema) answers[f.key] = schema;
  }
  return obj(
    {
      gevind: { type: "boolean", description: "Is hierdie werkblad in die PDF en het die leerders iets ingevul?" },
      antwoorde: obj(answers, "Slegs die LEERDERS se handskrif, finale weergawe"),
      juf: obj({
        kommentaar: { type: "array", items: { type: "string" }, description: "Onderwyser se kommentaar op die finale weergawe, een item per opmerking (insl. regmerkies soos “✓” en woorde soos “Puik”)" },
        kommentaar_vorige: { type: "array", items: { type: "string" }, description: "Onderwyser se kommentaar op ’n vroeëre, deurgehaalde of teruggestuurde weergawe van hierdie werkblad" },
        afgeteken: { type: "boolean", description: "Het ’n onderwyser die kontrolepunt by hierdie werkblad onderteken?" },
        afteken_datum: str("Datum van die jongste handtekening, soos geskryf; leeg as daar nie een is nie")
      }),
      onseker: { type: "array", items: { type: "string" }, description: "Woorde of dele wat jy nie seker kon lees nie, of waar jy nie seker is of dit leerder of onderwyser is nie" }
    },
    `Werkblad ${s.number}: ${s.title}`
  );
}

export function extractionSchema(t: Template): Json {
  return obj({
    groepnaam: str("Groepnaam op die voorblad (leeg as nie ingevul nie)"),
    klas: str("Klas op die voorblad"),
    lede: { type: "array", items: { type: "string" }, description: "Voorname (en vanne) van die groeplede op die voorblad, in volgorde" },
    werkblaaie: obj(Object.fromEntries(extractableSheets(t).map((s) => [s.key, sheetSchema(s)])))
  });
}

/** Beskrywing van die werkboek se bladsye vir die uitlees-opdrag. */
export function layoutText(t: Template): string {
  return extractableSheets(t)
    .map((s) => {
      const fields = s.sections.flatMap((sec) => sec.fields).filter((f) => f.type !== "info");
      const parts = fields.map((f) => {
        if (f.type === "teacherNote") return `  - [ONDERWYSER] ${f.label ?? "onderwyser se kommentaar"} (deur leerders oorgeskryf → juf.kommentaar)`;
        return `  - ${f.key}: ${f.label ?? f.title ?? ""} (${f.type})`;
      });
      return `Werkblad ${s.number} · ${s.title} → sleutel "${s.key}"\n${parts.join("\n")}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------- Terug na app-data

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function cleanRow(row: unknown, cols: Column[]): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const c of editableColumns(cols)) {
    const v = r[c.key];
    if (c.kind === "check") {
      if (v === true) out[c.key] = true;
    } else if (clean(v)) out[c.key] = clean(v);
  }
  return Object.keys(out).length ? out : null;
}

function fieldValue(f: Field, v: unknown): unknown {
  switch (f.type) {
    case "text":
    case "textarea":
    case "choice":
      return clean(v) || undefined;
    case "list": {
      // Lyste kry self nommers in die app; verwyder dus die leerders se eie “1.”, “-” of “->” vooraan.
      const items = (Array.isArray(v) ? v : [])
        .map((x) => clean(x).replace(/^(?:\(?\d{1,2}[.)]|->|→|[-–•*])\s*/u, "").trim())
        .filter(Boolean)
        .slice(0, f.count);
      return items.length ? items : undefined;
    }
    case "table": {
      if (f.rows?.length) {
        const src = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
        const out: Record<string, unknown> = {};
        for (const r of f.rows) {
          const row = cleanRow(src[r.key], f.columns);
          if (row) out[r.key] = row;
        }
        return Object.keys(out).length ? out : undefined;
      }
      const rows = (Array.isArray(v) ? v : []).map((r) => cleanRow(r, f.columns)).filter(Boolean);
      return rows.length ? rows.slice(0, f.maxRows ?? 50) : undefined;
    }
    case "matrix": {
      const src = v && typeof v === "object" ? (v as Record<string, Record<string, unknown>>) : {};
      const out: Record<string, Record<string, number>> = {};
      for (const r of f.rows) {
        for (const c of f.cols) {
          const n = src[r.key]?.[c.key];
          if (typeof n === "number" && Number.isFinite(n)) (out[r.key] ??= {})[c.key] = Math.min(f.max, Math.max(f.min, Math.round(n)));
        }
      }
      return Object.keys(out).length ? out : undefined;
    }
    case "entries": {
      const rows = (Array.isArray(v) ? v : []).map((r) => cleanRow(r, f.fields)).filter(Boolean);
      return rows.length ? rows : undefined;
    }
    default:
      return undefined;
  }
}

const strings = (v: unknown) => (Array.isArray(v) ? v.map(clean).filter(Boolean) : []);

/** Maak werkbladdata skoon volgens die sjabloon (vir die KI-uitlees én vir die onderwyser se regstellings). */
export function cleanSheetData(s: Sheet, answers: unknown): SheetData {
  const src = answers && typeof answers === "object" && !Array.isArray(answers) ? (answers as Record<string, unknown>) : {};
  const data: SheetData = {};
  for (const f of studentFields(s)) {
    if (f.type === "photos") continue;
    const v = fieldValue(f, src[f.key]);
    if (v !== undefined) data[f.key] = v as SheetData[string];
  }
  return data;
}

/** Werkblad met net die leerdervelde (sonder hulpteks, foto- en onderwyservelde), om te wys of te wysig. */
export function studentOnlySheet(s: Sheet): Sheet {
  return {
    ...s,
    sections: s.sections
      .map((sec) => ({ ...sec, intro: undefined, fields: sec.fields.filter((f) => f.type !== "info" && f.type !== "teacherNote" && f.type !== "photos") }))
      .filter((sec) => sec.fields.length)
  };
}

/** Skakel OpenAI se uitslag om na data wat die app se werkblaaie verstaan. */
export function normaliseExtraction(t: Template, raw: unknown): Extracted {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sheetsRaw = r.werkblaaie && typeof r.werkblaaie === "object" ? (r.werkblaaie as Record<string, Record<string, unknown>>) : {};
  const sheets: Record<string, ExtractedSheet> = {};
  for (const s of extractableSheets(t)) {
    const src = sheetsRaw[s.key];
    if (!src || src.gevind !== true) continue;
    const answers = src.antwoorde && typeof src.antwoorde === "object" ? (src.antwoorde as Record<string, unknown>) : {};
    const data = cleanSheetData(s, answers);
    const foto = studentFields(s).some((f) => f.type === "photos" && answers[f.key] === true);
    const juf = (src.juf ?? {}) as Record<string, unknown>;
    sheets[s.key] = {
      data,
      foto,
      juf: {
        kommentaar: strings(juf.kommentaar),
        kommentaar_vorige: strings(juf.kommentaar_vorige),
        afgeteken: juf.afgeteken === true,
        afteken_datum: clean(juf.afteken_datum)
      },
      onseker: strings(src.onseker)
    };
  }
  return { groepnaam: clean(r.groepnaam), klas: clean(r.klas), lede: strings(r.lede).slice(0, 4), sheets };
}

/** Lede-lys in die app se vorm: presies vier plekke (volle name; die anonimisering hanteer voor- en volle name). */
export function membersFrom(e: Extracted): string[] {
  return [0, 1, 2, 3].map((i) => e.lede[i] ?? "");
}

export function photoCountsFor(t: Template, e: Extracted, sheetKey: string): Record<string, number> {
  const s = t.sheets.find((x) => x.key === sheetKey);
  const field = s?.sections.flatMap((sec) => sec.fields).find((f) => f.type === "photos");
  return field && e.sheets[sheetKey]?.foto ? { [field.key]: 1 } : {};
}

/** Die onderwyser se kommentaar as teks (name van lede geanonimiseer as members gegee word). */
export function jufText(e: ExtractedSheet, members: string[]): string {
  const lines = [
    ...e.juf.kommentaar.map((k) => `- ${k}`),
    e.juf.afgeteken ? `- Kontrolepunt afgeteken${e.juf.afteken_datum ? ` (${e.juf.afteken_datum})` : ""}` : ""
  ].filter(Boolean);
  return redact(lines.join("\n"), members);
}
