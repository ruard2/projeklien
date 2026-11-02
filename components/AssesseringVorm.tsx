"use client";

import { useActionState, useState } from "react";
import { saveMarkAction, type MarkState } from "@/app/onderwyser/assessering-aksies";
import type { AssessmentCriterion } from "@/lib/assessering/ki";
import type { Rubric } from "@/lib/assessering/rubriek";

const CONF: Record<string, { label: string; tone: string }> = {
  hoog: { label: "KI redelik seker", tone: "ok" },
  medium: { label: "Tussen twee vlakke", tone: "warn" },
  laag: { label: "KI onseker: gaan mooi na", tone: "red" }
};

function sheetHref(groupId: string, ref: string) {
  return `/onderwyser/groep/${groupId}/ws${ref.replace(/\D/g, "")}`;
}

type Props = {
  rubric: Rubric;
  groupId: string;
  assessmentId: string | null;
  ai: AssessmentCriterion[];
  aiTotal: number | null;
  initial: Record<string, { punt: number; nota?: string }>;
  comment: string;
  assessors: string;
  status: string | null;
};

export default function AssesseringVorm(p: Props) {
  const [state, action, pending] = useActionState<MarkState, FormData>(saveMarkAction, undefined);
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      p.rubric.criteria.map((c) => {
        const saved = p.initial[c.id]?.punt;
        const ai = p.ai.find((k) => k.id === c.id)?.punt;
        return [c.id, saved !== undefined ? String(saved) : ai !== undefined ? String(ai) : ""];
      })
    )
  );
  const num = (id: string) => {
    const n = Number(scores[id]);
    return scores[id] !== "" && Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
  };
  const complete = p.rubric.criteria.every((c) => num(c.id) !== null);
  const total = p.rubric.criteria.reduce((sum, c) => sum + (num(c.id) ?? 0), 0);

  return (
    <form action={action}>
      <input type="hidden" name="groupId" value={p.groupId} />
      <input type="hidden" name="assessmentId" value={p.assessmentId ?? ""} />

      {p.rubric.criteria.map((c) => {
        const ai = p.ai.find((k) => k.id === c.id);
        const mine = num(c.id);
        const conf = ai ? CONF[ai.sekerheid] : null;
        return (
          <section className="section rb-section" key={c.id}>
            <header>
              {c.number}. {c.title} <span style={{ fontWeight: 400, opacity: 0.8 }}>({c.max} punte)</span>
            </header>
            <div className="body">
              <div className="rb-levels">
                {c.levels.map((l) => {
                  const isAi = ai?.vlak === l.level;
                  const isMine = mine !== null && mine >= l.min && mine <= l.max;
                  return (
                    <div key={l.level} className={`rb-level ${isMine ? "mine" : ""} ${isAi ? "ai" : ""}`}>
                      <div className="rb-level-head">
                        <b>Vlak {l.level}</b> {l.label} · <b>{l.band}</b>
                      </div>
                      <div>{l.text}</div>
                      <div className="rb-marks">
                        {isAi ? <span className="badge plain blue">KI</span> : null}
                        {isMine ? <span className="badge plain ok">Julle punt</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {ai ? (
                <div className="rb-ai">
                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    <b>KI-voorstel: {ai.punt}/{c.max}</b>
                    {conf ? <span className={`badge ${conf.tone}`}>{conf.label}</span> : null}
                  </div>
                  <p style={{ margin: "0 0 8px" }}>{ai.motivering}</p>
                  <p style={{ margin: "0 0 8px", fontSize: ".92rem" }}>
                    <b>Hoekom nie hoër nie:</b> {ai.waarom_nie_hoer}
                  </p>
                  {ai.bewyse.length ? (
                    <div style={{ marginBottom: 8 }}>
                      <div className="lbl" style={{ marginBottom: 4 }}>Bewyse uit die werkboek</div>
                      <ul className="rb-quotes">
                        {ai.bewyse.map((b, i) => (
                          <li key={i}>
                            <a href={sheetHref(p.groupId, b.werkblad)} target="_blank" rel="noreferrer">
                              {b.werkblad}
                            </a>{" "}
                            “{b.aanhaling}”{" "}
                            {b.gevind ? null : <span className="badge red" title="Hierdie woorde is nie letterlik in die werkboek gevind nie">nie letterlik gevind nie</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {ai.kontroleer.length ? (
                    <div className="alert warn" style={{ fontSize: ".9rem" }}>
                      <b>Gaan self na:</b>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                        {ai.kontroleer.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rb-final">
                <div>
                  <label className="lbl" htmlFor={`punt_${c.id}`}>
                    Julle punt
                  </label>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input
                      id={`punt_${c.id}`}
                      name={`punt_${c.id}`}
                      type="number"
                      min={0}
                      max={c.max}
                      step={1}
                      required
                      value={scores[c.id]}
                      onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.value }))}
                      style={{ width: 84, fontWeight: 700, fontSize: "1.1rem" }}
                    />
                    <b>/{c.max}</b>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <label className="lbl" htmlFor={`nota_${c.id}`}>
                    Julle nota (opsioneel)
                  </label>
                  <textarea id={`nota_${c.id}`} name={`nota_${c.id}`} rows={2} defaultValue={p.initial[c.id]?.nota ?? ""} />
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <section className="section" style={{ marginBottom: 12 }}>
        <div className="body grid-2">
          <div>
            <label className="lbl" htmlFor="assessors">Tweede beoordelaar</label>
            <input id="assessors" name="assessors" type="text" defaultValue={p.assessors} placeholder="Naam van jou kollega" />
          </div>
          <div>
            <label className="lbl" htmlFor="comment">Kommentaar oor die groep (opsioneel)</label>
            <textarea id="comment" name="comment" rows={2} defaultValue={p.comment} />
          </div>
        </div>
      </section>

      <div className="rb-bar">
        <div className="rb-total">
          <span>
            Totaal: <b className="rb-total-v">{total}</b>/{p.rubric.total}
          </span>
          {p.aiTotal !== null ? <span className="muted" style={{ fontSize: ".88rem" }}>KI: {p.aiTotal}/{p.rubric.total}</span> : null}
          {p.status === "FINAAL" ? <span className="badge ok">Finaal gestoor</span> : p.status === "KONSEP" ? <span className="badge warn">Konsep</span> : <span className="badge">Nog nie gestoor nie</span>}
        </div>
        <div className="btn-row no-print">
          {state?.error ? <small style={{ color: "var(--red)" }}>{state.error}</small> : null}
          {!complete ? <small className="muted">Gee ’n heel punt van 0 tot 10 by elke kriterium.</small> : null}
          <button className="btn sm" name="aksie" value="konsep" disabled={pending || !complete}>
            Konsep
          </button>
          <button className="btn sm ok" name="aksie" value="finaal" disabled={pending || !complete}>
            {pending ? <span className="spinner" /> : null} Stoor as finale punt
          </button>
        </div>
      </div>
    </form>
  );
}
