"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { sendDevFeedback, type ActionState } from "@/app/onderwyser/actions";

const KI_RATINGS = [
  { value: "reg", label: "👍 Reg" },
  { value: "te_streng", label: "Te streng" },
  { value: "te_sag", label: "Te sag" },
  { value: "verkeerd", label: "👎 Verkeerd" }
];

const GENERAL = [
  { value: "fout", label: "🐞 Fout" },
  { value: "voorstel", label: "💡 Voorstel" },
  { value: "vraag", label: "❓ Vraag" },
  { value: "ander", label: "Ander" }
];

function Chips({ name, options, value, onChange }: { name: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips" role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={`chip-opt ${value === o.value ? "on" : ""}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Blok onder die KI-terugvoer: die onderwyser beoordeel die KI. */
export function KiTerugvoerVorm({
  groupId,
  sheet,
  feedbackId,
  criteria
}: {
  groupId: string;
  sheet: string;
  feedbackId: string | null;
  criteria: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sendDevFeedback, undefined);
  const [rating, setRating] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      setRating("");
    }
  }, [state]);

  return (
    <form ref={form} action={action} className="dev-fb">
      <div className="dev-fb-title">
        <span aria-hidden>🛠️</span> Is die KI reg? <small>(gaan na die ontwikkelaar)</small>
      </div>
      <input type="hidden" name="kind" value="ki" />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="sheet" value={sheet} />
      <input type="hidden" name="feedbackId" value={feedbackId ?? ""} />
      <input type="hidden" name="page" value={pathname} />
      <Chips name="rating" options={KI_RATINGS} value={rating} onChange={setRating} />
      {criteria.length ? (
        <select name="criterionId" defaultValue="" aria-label="Oor watter kriterium?">
          <option value="">Oor die terugvoer in die algemeen</option>
          {criteria.map((c) => (
            <option key={c.id} value={c.id}>
              Kriterium: {c.title}
            </option>
          ))}
        </select>
      ) : null}
      <textarea name="message" rows={3} placeholder="Wat moet die KI anders doen? Bv. “Hierdie probleemstelling is goed genoeg vir Gr 9 – moenie so streng wees nie.”" />
      <div className="btn-row">
        <button className="btn sm primary" disabled={pending}>
          {pending ? <span className="spinner" /> : null} Stuur
        </button>
        {state?.ok ? <small style={{ color: "var(--ok)" }}>✓ Gestoor – dankie!</small> : null}
        {state?.error ? <small style={{ color: "var(--red)" }}>{state.error}</small> : null}
      </div>
    </form>
  );
}

/** Klein klets-ikoon regs onder op alle onderwyserbladsye. */
export function TerugvoerKnoppie() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState("voorstel");
  const [state, action, pending] = useActionState<ActionState, FormData>(sendDevFeedback, undefined);
  const form = useRef<HTMLFormElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <div className="fab-wrap no-print">
      {open ? (
        <div className="fab-panel" role="dialog" aria-label="Terugvoer aan die ontwikkelaar">
          <div className="fab-head">
            <b>Terugvoer aan die ontwikkelaar</b>
            <button type="button" className="btn ghost sm" aria-label="Maak toe" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <form ref={form} action={action} style={{ display: "grid", gap: 10 }}>
            <input type="hidden" name="kind" value="algemeen" />
            <input type="hidden" name="page" value={pathname} />
            <Chips name="rating" options={GENERAL} value={rating} onChange={setRating} />
            <textarea name="message" rows={5} placeholder="Wat werk nie, of wat kan beter? Die bladsy waarop jy is, word outomaties saamgestuur." autoFocus />
            <div className="btn-row">
              <button className="btn primary sm" disabled={pending}>
                {pending ? <span className="spinner" /> : null} Stuur
              </button>
              {state?.ok ? <small style={{ color: "var(--ok)" }}>✓ Dankie!</small> : null}
              {state?.error ? <small style={{ color: "var(--red)" }}>{state.error}</small> : null}
            </div>
          </form>
        </div>
      ) : null}
      <button type="button" className="fab" aria-label="Stuur terugvoer aan die ontwikkelaar" title="Terugvoer aan die ontwikkelaar" onClick={() => setOpen((o) => !o)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </svg>
      </button>
    </div>
  );
}
