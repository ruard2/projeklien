"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { memberDisplay } from "@/lib/werkboeke/teks";
import type {
  ChoiceField,
  Column,
  EntriesField,
  Field,
  InfoField,
  ListField,
  MatrixField,
  RowValue,
  Sheet,
  SheetData,
  TableField
} from "@/lib/werkboeke/tipes";
import FotoVeld, { type PhotoInfo } from "./FotoVeld";

export type TeacherNotes = Record<string, { text: string; by: string; at: string }>;

type Ctx = {
  readOnly: boolean;
  members: string[];
  sheetKey: string;
  photos: PhotoInfo[];
  photosEditable: boolean;
  onPhotosChange?: (p: PhotoInfo[]) => void;
  teacherNotes: TeacherNotes;
  missing: Set<string>;
  /** Toeganklike naam vir velde sonder eie etiket (die afdeling se titel) */
  titles: Record<string, string>;
};

type Props = {
  sheet: Sheet;
  sheetKey: string;
  data: SheetData;
  onChange?: (next: SheetData) => void;
  readOnly: boolean;
  members: string[];
  photos?: PhotoInfo[];
  photosEditable?: boolean;
  onPhotosChange?: (p: PhotoInfo[]) => void;
  teacherNotes?: TeacherNotes;
  /** Velde om te merk as onvolledig */
  missing?: string[];
};

export default function WerkbladVorm(props: Props) {
  const { sheet, data, onChange } = props;
  const ctx: Ctx = {
    readOnly: props.readOnly,
    members: props.members,
    sheetKey: props.sheetKey,
    photos: props.photos ?? [],
    photosEditable: Boolean(props.photosEditable),
    onPhotosChange: props.onPhotosChange,
    teacherNotes: props.teacherNotes ?? {},
    missing: new Set(props.missing ?? []),
    titles: Object.fromEntries(sheet.sections.flatMap((s) => s.fields.map((f) => [f.key, s.title ?? sheet.title])))
  };
  const set = (key: string, value: unknown) => onChange?.({ ...data, [key]: value });

  return (
    <div>
      {sheet.sections.map((section, i) => (
        <section className="section" key={i}>
          {section.title ? <header>{section.title}</header> : null}
          <div className="body">
            {section.intro ? <p className="intro">{section.intro}</p> : null}
            {section.fields.map((f) => (
              <div className="field" key={f.key} id={`veld-${f.key}`}>
                {f.label && f.type !== "info" && f.type !== "choice" ? <label className="lbl" htmlFor={`inp-${f.key}`}>{f.label}</label> : null}
                {f.help ? <p className="help">{f.help}</p> : null}
                <FieldView field={f} value={data[f.key]} set={(v) => set(f.key, v)} ctx={ctx} />
                {ctx.missing.has(f.key) && !ctx.readOnly ? (
                  <p className="help" style={{ color: "var(--red)", marginTop: 6 }}>Hierdie deel is nog nie volledig nie.</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FieldView({ field, value, set, ctx }: { field: Field; value: unknown; set: (v: unknown) => void; ctx: Ctx }) {
  switch (field.type) {
    case "text":
      return ctx.readOnly ? (
        <ReadText value={value} />
      ) : (
        <input id={`inp-${field.key}`} type="text" value={str(value)} placeholder={field.placeholder} maxLength={300} onChange={(e) => set(e.target.value)} />
      );
    case "textarea":
      return ctx.readOnly ? (
        <ReadText value={value} block />
      ) : (
        <AutoTextarea id={`inp-${field.key}`} ariaLabel={field.label ? undefined : ctx.titles[field.key]} value={str(value)} rows={field.rows ?? 4} placeholder={field.placeholder} onChange={set} />
      );
    case "list":
      return <ListView field={field} value={value} set={set} ctx={ctx} />;
    case "table":
      return field.rows ? <FixedTable field={field} value={value} set={set} ctx={ctx} /> : <FreeTable field={field} value={value} set={set} ctx={ctx} />;
    case "matrix":
      return <MatrixView field={field} value={value} set={set} ctx={ctx} />;
    case "choice":
      return <ChoiceView field={field} value={value} set={set} ctx={ctx} />;
    case "entries":
      return <EntriesView field={field} value={value} set={set} ctx={ctx} />;
    case "photos":
      return (
        <FotoVeld
          sheetKey={ctx.sheetKey}
          field={field.key}
          max={field.max}
          photos={ctx.photos.filter((p) => p.field === field.key)}
          editable={ctx.photosEditable}
          onChange={(list) => ctx.onPhotosChange?.([...ctx.photos.filter((p) => p.field !== field.key), ...list])}
        />
      );
    case "info":
      return <InfoView field={field} />;
    case "teacherNote": {
      const note = ctx.teacherNotes[field.key];
      return (
        <div className="teacher-note">
          {note?.text ? (
            <>
              <div style={{ whiteSpace: "pre-wrap" }}>{note.text}</div>
              <div className="by">
                — {note.by}, {new Date(note.at).toLocaleDateString("af-ZA", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </>
          ) : (
            <span className="muted">Die onderwyser het nog nie kommentaar gelewer nie.</span>
          )}
        </div>
      );
    }
  }
}

// ---------------------------------------------------------------- Hulpmiddels

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

function ReadText({ value, block }: { value: unknown; block?: boolean }) {
  const s = str(value).trim();
  if (!s) return <div className="muted" style={{ fontStyle: "italic", fontSize: ".9rem" }}>—</div>;
  return <div style={{ whiteSpace: "pre-wrap", padding: block ? "4px 2px" : 0 }}>{s}</div>;
}

export function AutoTextarea({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
  ariaLabel
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      rows={rows}
      placeholder={placeholder}
      aria-label={ariaLabel}
      maxLength={8000}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Vrye naamveld; name van die voorblad verskyn as voorstelle. */
function MemberInput({ value, onChange, ctx, aria }: { value: unknown; onChange: (v: string) => void; ctx: Ctx; aria: string }) {
  const listId = useId();
  const shown = memberDisplay(value, ctx.members);
  if (ctx.readOnly) return <ReadText value={shown} />;
  const names = ctx.members.map((m) => m.trim()).filter(Boolean);
  return (
    <>
      <input
        aria-label={aria}
        type="text"
        value={shown}
        placeholder="Naam"
        maxLength={60}
        autoComplete="off"
        list={names.length ? listId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {names.length > 0 && (
        <datalist id={listId}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      )}
    </>
  );
}

function CellInput({ col, row, onCell, ctx, rowLabel }: { col: Column; row: RowValue; onCell: (k: string, v: unknown) => void; ctx: Ctx; rowLabel?: string }) {
  const v = row[col.key];
  const aria = rowLabel ? `${rowLabel} – ${col.label}` : col.label;
  if (col.kind === "check") {
    return <input type="checkbox" className="check" aria-label={aria} checked={Boolean(v)} disabled={ctx.readOnly} onChange={(e) => onCell(col.key, e.target.checked)} />;
  }
  if (col.kind === "member") {
    return <MemberInput value={v} onChange={(x) => onCell(col.key, x)} ctx={ctx} aria={aria} />;
  }
  if (col.kind === "select") {
    if (ctx.readOnly) return <ReadText value={v} />;
    return (
      <select aria-label={aria} value={str(v)} onChange={(e) => onCell(col.key, e.target.value)}>
        <option value="">—</option>
        {(col.options ?? []).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  if (ctx.readOnly) return <ReadText value={col.kind === "currency" && str(v) ? `R ${str(v)}` : v} />;
  if (col.kind === "textarea") return <AutoTextarea ariaLabel={aria} value={str(v)} rows={2} placeholder={col.placeholder} onChange={(x) => onCell(col.key, x)} />;
  if (col.kind === "date") return <input aria-label={aria} type="date" value={str(v)} onChange={(e) => onCell(col.key, e.target.value)} />;
  if (col.kind === "currency" || col.kind === "number") {
    return (
      <input
        aria-label={aria}
        type="text"
        inputMode="decimal"
        value={str(v)}
        placeholder={col.kind === "currency" ? "0.00" : ""}
        onChange={(e) => onCell(col.key, e.target.value.replace(/[^\d.,]/g, ""))}
      />
    );
  }
  return <input aria-label={aria} type="text" value={str(v)} maxLength={500} placeholder={col.placeholder} onChange={(e) => onCell(col.key, e.target.value)} />;
}

const num = (v: unknown) => Number(str(v).replace(",", ".")) || 0;
const asObj = (v: unknown): Record<string, RowValue> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, RowValue>) : {});
const asArr = (v: unknown): RowValue[] => (Array.isArray(v) ? (v as RowValue[]) : []);

// ---------------------------------------------------------------- Lys

function ListView({ field, value, set, ctx }: { field: ListField; value: unknown; set: (v: unknown) => void; ctx: Ctx }) {
  const items = Array.from({ length: field.count }, (_, i) => str(asArr(value)[i] as unknown));
  return (
    <div className="list-field">
      {items.map((it, i) => (
        <div className="list-item" key={i}>
          <span className="n">{i + 1}</span>
          {ctx.readOnly ? (
            <ReadText value={it} block />
          ) : (
            <AutoTextarea
              value={it}
              rows={2}
              ariaLabel={`${i + 1}`}
              placeholder={field.placeholder}
              onChange={(v) => {
                const next = [...items];
                next[i] = v;
                set(next);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Tabelle

function FixedTable({ field, value, set, ctx }: { field: TableField; value: unknown; set: (v: unknown) => void; ctx: Ctx }) {
  const data = asObj(value);
  const onCell = (rowKey: string) => (k: string, v: unknown) => set({ ...data, [rowKey]: { ...(data[rowKey] ?? {}), [k]: v } });
  return (
    <div className="table-wrap">
      <table className="wtable stack">
        <thead>
          <tr>
            <th>{field.rowHeader ?? ""}</th>
            {field.columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {field.rows!.map((r) => (
            <tr key={r.key}>
              <td className="rowlabel">{r.label}</td>
              {field.columns.map((c) =>
                c.kind === "static" ? (
                  <td key={c.key} className="static" data-label={c.label}>
                    {r.cells?.[c.key]}
                  </td>
                ) : (
                  <td key={c.key} data-label={c.label} className={c.kind === "check" ? "center" : undefined}>
                    <CellInput col={c} row={data[r.key] ?? {}} onCell={onCell(r.key)} ctx={ctx} rowLabel={r.label} />
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FreeTable({ field, value, set, ctx }: { field: TableField; value: unknown; set: (v: unknown) => void; ctx: Ctx }) {
  const stored = asArr(value);
  const initial = ctx.readOnly ? 0 : field.initialRows ?? 1;
  const rows: RowValue[] = stored.length >= initial ? stored : [...stored, ...Array.from({ length: initial - stored.length }, () => ({}))];
  const max = field.maxRows ?? 20;
  const update = (i: number, k: string, v: unknown) => set(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const remove = (i: number) => set(rows.filter((_, j) => j !== i));
  const total = field.total ? rows.reduce((a, r) => a + num(r[field.total!.column]), 0) : 0;
  const totalIdx = field.total ? field.columns.findIndex((c) => c.key === field.total!.column) : -1;

  if (ctx.readOnly && rows.length === 0) return <div className="muted" style={{ fontStyle: "italic" }}>Nog niks ingevul nie.</div>;

  return (
    <>
      <div className="table-wrap">
        <table className="wtable stack">
          <thead>
            <tr>
              {field.columns.map((c) => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                  {c.label}
                </th>
              ))}
              {!ctx.readOnly ? <th aria-label="Aksies" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {field.columns.map((c) => (
                  <td key={c.key} data-label={c.label} className={c.kind === "check" ? "center" : undefined}>
                    <CellInput col={c} row={r} onCell={(k, v) => update(i, k, v)} ctx={ctx} rowLabel={`Ry ${i + 1}`} />
                  </td>
                ))}
                {!ctx.readOnly ? (
                  <td className="actions">
                    <button type="button" className="btn ghost sm" title="Verwyder ry" aria-label={`Verwyder ry ${i + 1}`} onClick={() => remove(i)} disabled={rows.length <= 1}>
                      ✕
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          {field.total ? (
            <tfoot>
              <tr>
                {field.columns.map((c, i) => (
                  <td key={c.key} data-label={i === totalIdx ? field.total!.label : undefined}>
                    {i === 0 ? field.total!.label : i === totalIdx ? `R ${total.toFixed(2)}` : ""}
                  </td>
                ))}
                {!ctx.readOnly ? <td /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {!ctx.readOnly && rows.length < max ? (
        <button type="button" className="btn sm add-row" onClick={() => set([...rows, {}])}>
          + {field.addLabel ?? "Nog ’n ry"}
        </button>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- Keusematriks

function MatrixView({ field, value, set, ctx }: { field: MatrixField; value: unknown; set: (v: unknown) => void; ctx: Ctx }) {
  const data = asObj(value);
  const totals = field.cols.map((c) => field.rows.reduce((a, r) => a + num(data[r.key]?.[c.key]), 0));
  const best = Math.max(...totals);
  const scores = Array.from({ length: field.max - field.min + 1 }, (_, i) => String(field.min + i));
  return (
    <div className="table-wrap">
      <table className="wtable stack matrix">
        <thead>
          <tr>
            <th>{field.rowHeader}</th>
            {field.cols.map((c) => (
              <th key={c.key} style={{ width: "6.5rem", textAlign: "center" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {field.rows.map((r) => (
            <tr key={r.key}>
              <td className="rowlabel">{r.label}</td>
              {field.cols.map((c) => {
                const v = str(data[r.key]?.[c.key]);
                return (
                  <td key={c.key} data-label={c.label} className="center">
                    {ctx.readOnly ? (
                      <b>{v || "–"}</b>
                    ) : (
                      <select
                        className="score"
                        aria-label={`${r.label} – ${c.label}`}
                        value={v}
                        onChange={(e) => set({ ...data, [r.key]: { ...(data[r.key] ?? {}), [c.key]: e.target.value ? Number(e.target.value) : null } })}
                      >
                        <option value="">–</option>
                        {scores.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{field.totalLabel}</td>
            {totals.map((t, i) => (
              <td key={i} className="center" data-label={field.cols[i].label} style={t === best && t > 0 ? { color: "var(--ok)" } : undefined}>
                {t} / {field.rows.length * field.max}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Keuse

function ChoiceView({ field, value, set, ctx }: { field: ChoiceField; value: unknown; set: (v: unknown) => void; ctx: Ctx }) {
  return (
    <div className="choice" role="radiogroup" aria-label={field.label}>
      {field.label ? <span className="lbl" style={{ margin: "0 8px 0 0" }}>{field.label}</span> : null}
      {field.options.map((o) => (
        <label className="opt" key={o.value}>
          <input type="radio" name={field.key} value={o.value} checked={str(value) === o.value} disabled={ctx.readOnly} onChange={() => set(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Logboek-inskrywings

function EntriesView({ field, value, set, ctx }: { field: EntriesField; value: unknown; set: (v: unknown) => void; ctx: Ctx }) {
  const stored = asArr(value);
  const entries = stored.length || ctx.readOnly ? stored : [{}];
  const max = field.maxEntries ?? 20;
  const update = (i: number, k: string, v: unknown) => set(entries.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  if (ctx.readOnly && entries.length === 0) return <div className="muted" style={{ fontStyle: "italic" }}>Nog geen inskrywings nie.</div>;
  return (
    <div>
      {entries.map((e, i) => (
        <div className="entry" key={i}>
          <div className="entry-head">
            <b>
              {field.entryLabel} {i + 1}
            </b>
            {!ctx.readOnly && entries.length > 1 ? (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  if (confirm(`Verwyder ${field.entryLabel.toLowerCase()} ${i + 1}?`)) set(entries.filter((_, j) => j !== i));
                }}
              >
                Verwyder
              </button>
            ) : null}
          </div>
          <div className="entry-grid">
            {field.fields.map((c) => (
              <FragmentRow key={c.key} label={c.label}>
                <CellInput col={c} row={e} onCell={(k, v) => update(i, k, v)} ctx={ctx} rowLabel={`${field.entryLabel} ${i + 1}`} />
              </FragmentRow>
            ))}
          </div>
        </div>
      ))}
      {!ctx.readOnly && entries.length < max ? (
        <button type="button" className="btn sm add-row" onClick={() => set([...entries, { datum: new Date().toISOString().slice(0, 10) }])}>
          + Nuwe {field.entryLabel.toLowerCase()}
        </button>
      ) : null}
    </div>
  );
}

function FragmentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <label>{label}</label>
      <div>{children}</div>
    </>
  );
}

// ---------------------------------------------------------------- Inligting

function InfoView({ field }: { field: InfoField }) {
  return (
    <div className="infobox">
      {field.title ? <h4>{field.title}</h4> : null}
      {field.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {field.examples?.length ? (
        <div className="examples">
          {field.examples.map((e, i) => (
            <div key={i} className={`example ${e.tone}`}>
              <span className="tag">{e.label}</span>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
