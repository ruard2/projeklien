// Tipes vir werkboek-sjablone. 'n Sjabloon beskryf 'n hele VOL-werkboek as data:
// inleiding, fases, kontrolepunte, werkblaaie (velde) en die kriteria per werkblad.

export type Column = {
  key: string;
  label: string;
  /** static = vaste teks per ry (sien Table.rows[].cells), member = kies 'n groeplid */
  kind: "text" | "textarea" | "number" | "currency" | "check" | "select" | "static" | "member" | "date";
  options?: string[];
  width?: string;
  placeholder?: string;
  /** Hoef nie ingevul te wees vir volledigheid nie */
  optional?: boolean;
};

export type FixedRow = { key: string; label: string; cells?: Record<string, string> };

type FieldBase = {
  key: string;
  label?: string;
  /** Naam in boodskappe (bv. "nog nie volledig nie") as daar geen etiket is nie */
  title?: string;
  help?: string;
  /** Moet ingevul wees voordat terugvoer gevra kan word. */
  required?: boolean;
};

export type TextField = FieldBase & { type: "text"; placeholder?: string };
export type TextareaField = FieldBase & { type: "textarea"; rows?: number; placeholder?: string; prefix?: string };
export type ListField = FieldBase & { type: "list"; count: number; minFilled?: number; placeholder?: string };
export type TableField = FieldBase & {
  type: "table";
  columns: Column[];
  /** Vaste rye (eerste kolom is dan die ry-etiket). Sonder rows is die tabel vry. */
  rows?: FixedRow[];
  rowHeader?: string;
  initialRows?: number;
  minRows?: number;
  maxRows?: number;
  addLabel?: string;
  /** By vaste rye: elke ry moet volledig wees (anders: ten minste een ry) */
  requireAllRows?: boolean;
  /** Som van 'n getal-/geldkolom onderaan */
  total?: { column: string; label: string };
};
export type MatrixField = FieldBase & {
  type: "matrix";
  rowHeader: string;
  rows: FixedRow[];
  cols: { key: string; label: string }[];
  min: number;
  max: number;
  totalLabel: string;
};
export type ChoiceField = FieldBase & { type: "choice"; options: { value: string; label: string }[]; inline?: boolean };
export type PhotosField = FieldBase & { type: "photos"; max: number };
export type EntriesField = FieldBase & {
  type: "entries";
  entryLabel: string;
  fields: Column[];
  minEntries?: number;
  maxEntries?: number;
};
export type TeacherNoteField = FieldBase & { type: "teacherNote" };
export type InfoField = FieldBase & {
  type: "info";
  tone?: "tip" | "warn" | "plain";
  title?: string;
  body: string[];
  examples?: { label: string; text: string; tone: "bad" | "good" }[];
};

export type Field =
  | TextField
  | TextareaField
  | ListField
  | TableField
  | MatrixField
  | ChoiceField
  | PhotosField
  | EntriesField
  | TeacherNoteField
  | InfoField;

export type Section = { title?: string; intro?: string; fields: Field[] };

export type Criterion = {
  id: string;
  /** Kort naam wat leerders sien */
  title: string;
  /** Wat presies verwag word — word aan die KI en die leerders gewys */
  description: string;
};

export type Sheet = {
  key: string;
  number: number | null;
  title: string;
  intro?: string;
  phase: number | null;
  checkpoint: number | null;
  /** Elke lid vul dit self in (bv. persoonlike refleksie). Stoor as "<key>:<lid>" */
  perMember?: boolean;
  /** Vra KI-terugvoer (voorblad nie) */
  feedback: boolean;
  /** Ander werkblaaie wat as konteks saamgestuur word */
  context?: string[];
  sections: Section[];
  criteria: Criterion[];
};

export type Phase = {
  key: string;
  label: string;
  dates: string;
  what: string;
  ready: string;
  note?: string;
  kind?: "phase" | "break" | "expo";
};

export type CheckpointDef = {
  number: number;
  title: string;
  statement: string;
  sheets: string[];
};

export type Rule = { name: string; meaning: string };

export type Template = {
  key: string;
  version: number;
  label: string;
  grade: number;
  defaults: { phenomenon: string; question: string; partner: string; place: string };
  intro: {
    how: string;
    howBullets: string[];
    expoGoals: { title: string; text: string }[];
    notExpected: string;
  };
  rules?: { intro: string; items: Rule[] };
  phases: Phase[];
  checkpoints: CheckpointDef[];
  sheets: Sheet[];
  /** Ekstra agtergrond vir die KI (bv. wie die vennoot is) */
  aiContext: string;
};

// ---- Data wat in Response.data gestoor word ----
export type RowValue = Record<string, string | boolean | number | null>;
export type SheetData = Record<string, unknown>;
