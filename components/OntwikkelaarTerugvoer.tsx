"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { sendDevFeedback, type ActionState } from "@/app/onderwyser/actions";

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
        <span>Beoordeel hierdie KI-antwoord</span>
        <small>Jou beoordeling gaan na die administrateur/ontwikkelaar.</small>
      </div>
      <input type="hidden" name="kind" value="ki" />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="sheet" value={sheet} />
      <input type="hidden" name="feedbackId" value={feedbackId ?? ""} />
      <input type="hidden" name="page" value={pathname} />
      <input type="hidden" name="rating" value={rating} />
      <div className="ai-vote-row" role="group" aria-label="Is hierdie KI-antwoord reg?">
        <button type="button" className={`ai-vote yes ${rating === "reg" ? "on" : ""}`} aria-pressed={rating === "reg"} onClick={() => setRating("reg")}>
          <span className="ai-vote-icon" aria-hidden>👍</span>
          <span><b>Reg</b><small>Die KI het goed beoordeel</small></span>
        </button>
        <button type="button" className={`ai-vote no ${rating === "verkeerd" ? "on" : ""}`} aria-pressed={rating === "verkeerd"} onClick={() => setRating("verkeerd")}>
          <span className="ai-vote-icon" aria-hidden>👎</span>
          <span><b>Nie reg nie</b><small>Gee ’n rede sodat ons dit kan verbeter</small></span>
        </button>
      </div>

      {rating === "verkeerd" ? (
        <div className="ai-vote-details">
          <div>
            <label className="lbl" htmlFor={`ki-issue-type-${feedbackId}`}>Wat het verkeerd geloop?</label>
            <select id={`ki-issue-type-${feedbackId}`} name="issueType" defaultValue="verkeerde_oordeel" required>
              <option value="verkeerde_oordeel">Die KI se oordeel is verkeerd</option>
              <option value="te_streng">Die KI is te streng</option>
              <option value="te_sag">Die KI is te toegeeflik</option>
              <option value="onduidelik">Die terugvoer is onduidelik</option>
              <option value="antwoord_weggegee">Die KI gee die antwoord weg</option>
              <option value="taal">Die taal of bewoording is verkeerd</option>
              <option value="veiligheid_privaatheid">Veiligheids- of privaatheidsprobleem</option>
              <option value="ander">Ander probleem</option>
            </select>
          </div>
          {criteria.length ? (
            <div>
              <label className="lbl" htmlFor={`ki-criterion-${feedbackId}`}>Watter deel van die beoordeling?</label>
              <select id={`ki-criterion-${feedbackId}`} name="criterionId" defaultValue="">
                <option value="">Die KI-antwoord in die algemeen</option>
                {criteria.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          ) : null}
          <div>
            <label className="lbl" htmlFor={`ki-message-${feedbackId}`}>Waarom is dit nie reg nie?</label>
            <textarea id={`ki-message-${feedbackId}`} name="message" rows={3} required placeholder="Verduidelik kortliks wat die KI verkeerd beoordeel het en wat dit eerder moes doen." />
          </div>
          <details className="ai-vote-advanced">
            <summary>Meer besonderhede (opsioneel)</summary>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div>
                <label className="lbl" htmlFor={`ki-expected-${feedbackId}`}>Wat moes die oordeel wees?</label>
                <select id={`ki-expected-${feedbackId}`} name="expectedVerdict" defaultValue="">
                  <option value="">Nie van toepassing nie</option>
                  <option value="behaal">Behaal</option>
                  <option value="gedeeltelik">Gedeeltelik</option>
                  <option value="nie_behaal">Nog nie behaal nie</option>
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor={`ki-scope-${feedbackId}`}>Waar moet dit reggestel word?</label>
                <select id={`ki-scope-${feedbackId}`} name="scope" defaultValue="hierdie_antwoord">
                  <option value="hierdie_antwoord">Net hierdie antwoord</option>
                  <option value="hierdie_werkblad">Hierdie werkblad vir alle groepe</option>
                  <option value="hierdie_werkboek">Hierdie hele werkboek</option>
                  <option value="alle_werkboeke">Alle werkboeke</option>
                </select>
              </div>
            </div>
          </details>
        </div>
      ) : rating === "reg" ? <p className="muted ai-vote-note">Dankie. Bevestig hieronder dat hierdie KI-antwoord reg was.</p> : <p className="muted ai-vote-note">Kies 👍 of 👎. By 👎 kan jy dadelik die rede verduidelik.</p>}

      {rating ? (
        <div className="btn-row">
          <button className={`btn sm ${rating === "verkeerd" ? "primary" : "ok"}`} disabled={pending}>
            {pending ? <span className="spinner" /> : null} {rating === "verkeerd" ? "Stuur KI-terugvoer" : "Stuur beoordeling"}
          </button>
          <button type="button" className="btn ghost sm" onClick={() => setRating("")}>Kanselleer</button>
        </div>
      ) : null}
      {state?.ok ? <div className="alert ok" style={{ fontSize: ".86rem" }}>✓ Gestoor. Jy kan dit onder “My terugvoer” volg.</div> : null}
      {state?.error ? <small style={{ color: "var(--red)" }}>{state.error}</small> : null}
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
              {state?.ok ? <small style={{ color: "var(--ok)" }}>✓ Gestoor – volg dit onder “My terugvoer”.</small> : null}
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
