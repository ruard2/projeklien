import type { FeedbackResult } from "@/lib/ki";
import type { Criterion } from "@/lib/werkboeke/tipes";
import RapporteerKi from "./RapporteerKi";

const MARK: Record<string, string> = { behaal: "✓", gedeeltelik: "~", nie_behaal: "!", pending: "" };
const VERDICT_LABEL: Record<string, string> = { behaal: "Behaal", gedeeltelik: "Gedeeltelik", nie_behaal: "Nog nie" };

export type FeedbackView = {
  id: string;
  result: FeedbackResult;
  ready: boolean;
  source: string;
  createdAt: string;
  stale: boolean;
  report?: { status: string; resolution: string | null } | null;
};

export function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("af-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Kriteria-lys, met of sonder ’n oordeel. */
export function Kriteria({ criteria, result, showDescriptions = true }: { criteria: Criterion[]; result?: FeedbackResult | null; showDescriptions?: boolean }) {
  const byId = new Map((result?.kriteria ?? []).map((k) => [k.id, k]));
  return (
    <div className="crit">
      {criteria.map((c) => {
        const k = byId.get(c.id);
        const cls = k ? k.oordeel : "pending";
        return (
          <div key={c.id} className={`crit-item ${cls}`}>
            <div className="ch">
              <span className="dot" aria-label={k ? VERDICT_LABEL[k.oordeel] : "Nog nie beoordeel nie"}>
                {MARK[cls]}
              </span>
              <div>
                <div className="ct">{c.title}</div>
                {showDescriptions && (!k || k.oordeel !== "behaal") ? <div className="cd">{c.description}</div> : null}
                {k && k.terugvoer && k.terugvoer !== "(toetsmodus)" ? <div className="fb">{k.terugvoer}</div> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TerugvoerInhoud({ fb, criteria, reportSheet }: { fb: FeedbackView; criteria: Criterion[]; reportSheet?: string }) {
  const r = fb.result;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className={`badge ${fb.ready ? "ok" : "warn"}`}>{fb.ready ? "Gereed vir onderwyser" : "Nog nie gereed nie"}</span>
        <small>{fmtWhen(fb.createdAt)}</small>
        {fb.source === "toetsmodus" ? <span className="badge plain">toetsmodus</span> : null}
      </div>
      {fb.stale ? <div className="alert warn">Julle het die werkblad verander sedert hierdie terugvoer. Vra weer terugvoer om die nuwe weergawe te laat nagaan.</div> : null}
      {r.opsomming ? <p style={{ margin: 0 }}>{r.opsomming}</p> : null}

      {r.ontbrekend?.length ? (
        <div>
          <div className="lbl">Nog nie volledig nie</div>
          <ul className="qlist">
            {r.ontbrekend.map((m) => (
              <li key={m.key}>
                <a href={`#veld-${m.key}`}>{m.title}</a> – {m.problem}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.reelkwessies.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {r.reelkwessies.map((q, i) => (
            <div className="rule-issue" key={i}>
              <b>{q.reel}:</b> {q.beskrywing}
            </div>
          ))}
        </div>
      ) : null}

      {r.sterkpunte.length ? (
        <div>
          <div className="lbl">Wat goed is</div>
          <ul className="qlist">
            {r.sterkpunte.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.vrae.length ? (
        <div>
          <div className="lbl">Vrae om oor te dink</div>
          <ul className="qlist">
            {r.vrae.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.kriteria.length ? (
        <div>
          <div className="lbl">Kriteria</div>
          <Kriteria criteria={criteria} result={r} />
        </div>
      ) : null}
      {reportSheet ? <RapporteerKi feedbackId={fb.id} sheet={reportSheet} existing={fb.report ?? null} /> : null}
    </div>
  );
}
