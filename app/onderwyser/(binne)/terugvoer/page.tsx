import Link from "next/link";
import { promoteFeedbackToEval, setAiReportStatus, setDevFeedbackStatus } from "@/app/onderwyser/actions";
import { db } from "@/lib/db";
import { requireFeedbackReviewer } from "@/lib/sessie";
import { AI_REPORT_LABELS } from "@/lib/terugvoer-beheer";
import { devFeedbackRows } from "@/lib/terugvoer-uitvoer";

export const metadata = { title: "Ontwikkelaarterugvoer" };

const STATUS = [
  { key: "", label: "Alles" },
  { key: "nuut", label: "Nuut" },
  { key: "gelees", label: "Gelees" },
  { key: "verwerk", label: "Verwerk" }
];

const RATING_TONE: Record<string, string> = { Reg: "ok", "Te streng": "warn", "Te sag": "warn", Verkeerd: "red", Fout: "red", Voorstel: "blue", Vraag: "blue" };
const SCOPE_LABEL: Record<string, string> = {
  hierdie_antwoord: "net hierdie antwoord",
  hierdie_werkblad: "hierdie werkblad",
  hierdie_werkboek: "hierdie werkboek",
  alle_werkboeke: "alle werkboeke"
};
const ISSUE_LABEL: Record<string, string> = {
  verkeerde_oordeel: "Verkeerde oordeel",
  te_streng: "Te streng",
  te_sag: "Te toegeeflik",
  onduidelik: "Onduidelike terugvoer",
  antwoord_weggegee: "Gee die antwoord weg",
  taal: "Taal of bewoording",
  veiligheid_privaatheid: "Veiligheid of privaatheid",
  ander: "Ander probleem"
};
const VERDICT_LABEL: Record<string, string> = { behaal: "Behaal", gedeeltelik: "Gedeeltelik", nie_behaal: "Nog nie behaal nie" };

export default async function TerugvoerOorsig({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const reviewer = await requireFeedbackReviewer();
  const sp = await searchParams;
  const status = STATUS.some((item) => item.key === sp.status) ? sp.status : "";
  const [rows, counts, reportCounts, reports] = await Promise.all([
    devFeedbackRows(reviewer.schoolId, { status: status || undefined, take: 300 }),
    db.devFeedback.groupBy({ by: ["status"], where: { schoolId: reviewer.schoolId }, _count: { _all: true } }),
    db.aiReport.groupBy({ by: ["status"], where: { schoolId: reviewer.schoolId }, _count: { _all: true } }),
    db.aiReport.findMany({ where: { schoolId: reviewer.schoolId, ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 300 })
  ]);
  const count = (key: string) => counts.find((item) => item.status === key)?._count._all ?? 0;
  const reportCount = (key: string) => reportCounts.find((item) => item.status === key)?._count._all ?? 0;
  const items = await db.devFeedback.findMany({ where: { id: { in: rows.map((row) => row.id) } } });
  const reportGroups = await db.group.findMany({
    where: { id: { in: [...new Set(reports.map((report) => report.groupId))] } },
    include: { project: true }
  });
  const newNegativeAi = rows.filter((row) => row.status === "nuut" && row.soort === "KI-terugvoer" && row.oordeel !== "Reg");

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 14 }}>
        <h1 className="grow" style={{ margin: 0 }}>Ontwikkelaarterugvoer</h1>
        <a className="btn sm" href="/api/terugvoer?formaat=csv">⬇ Excel (CSV)</a>
        <a className="btn sm" href="/api/terugvoer?formaat=json">⬇ JSON</a>
        <a className="btn sm" href="/api/terugvoer/verslae?formaat=csv">⬇ KI-verslae</a>
      </div>
      <p className="muted" style={{ maxWidth: "80ch" }}>
        Onderwyserterugvoer en leerderverslae bly in ’n mens-beheerde ry. Merk wat ondersoek is, antwoord die onderwyser, en teken aan wanneer die bevinding in ’n permanente KI-toets opgeneem is.
      </p>

      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))" }}>
        <div className={`stat ${count("nuut") || reportCount("nuut") ? "attn" : ""}`}><div className="v">{count("nuut") + reportCount("nuut")}</div><div className="l">nuut</div></div>
        <div className={`stat ${newNegativeAi.length ? "attn" : ""}`}><div className="v">{newNegativeAi.length}</div><div className="l">nuwe 👎 KI-beoordelings</div></div>
        <div className="stat"><div className="v">{count("gelees") + reportCount("gelees")}</div><div className="l">gelees</div></div>
        <div className="stat"><div className="v">{count("verwerk") + reportCount("verwerk")}</div><div className="l">verwerk</div></div>
        <div className="stat"><div className="v">{count("nuut") + count("gelees") + count("verwerk") + reportCount("nuut") + reportCount("gelees") + reportCount("verwerk")}</div><div className="l">totaal</div></div>
      </div>

      <div className="tabs">
        {STATUS.map((item) => <Link key={item.key} href={item.key ? `/onderwyser/terugvoer?status=${item.key}` : "/onderwyser/terugvoer"} className={status === item.key ? "on" : ""}>{item.label}</Link>)}
      </div>

      {newNegativeAi.length ? (
        <section className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--red)" }}>
          <h2 style={{ marginTop: 0 }}>👎 Nuwe KI-terugvoer wat aandag nodig het</h2>
          <p className="muted">Klik op ’n inskrywing om die volledige KI-antwoord, onderwyser se rede en groepkonteks saam te lees.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {newNegativeAi.map((row) => (
              <a key={row.id} href={`#feedback-${row.id}`} className="teacher-note" style={{ display: "block", color: "inherit" }}>
                <b>{row.onderwyser}</b> · {row.oordeel || "Nie reg nie"}{row.projek ? ` · ${row.projek}` : ""}{row.werkblad ? ` · ${row.werkblad}` : ""}
                <span className="muted" style={{ display: "block", marginTop: 3 }}>{row.boodskap || ISSUE_LABEL[row.probleemtipe] || "Geen verduideliking gegee nie."}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <h2>Leerderverslae oor KI-antwoorde</h2>
      {reports.length === 0 ? <div className="card empty">Geen leerderverslae in hierdie aansig nie.</div> : reports.map((report) => {
        const group = reportGroups.find((item) => item.id === report.groupId);
        return (
          <article className="card" key={report.id} style={report.status === "nuut" ? { borderLeft: "4px solid var(--red)" } : undefined}>
            <div className="row" style={{ gap: 8 }}>
              <span className="badge red">KI-verslag</span>
              <b>{AI_REPORT_LABELS[report.category as keyof typeof AI_REPORT_LABELS] ?? report.category}</b>
              <small className="muted">{report.createdAt.toLocaleString("af-ZA")}</small><span className="grow" />
              <span className={`badge ${report.status === "verwerk" ? "ok" : report.status === "nuut" ? "red" : "plain"}`}>{report.status}</span>
            </div>
            {report.message ? <p style={{ whiteSpace: "pre-wrap" }}>{report.message}</p> : <p className="muted">Geen verdere verduideliking nie.</p>}
            <p className="muted" style={{ fontSize: ".86rem" }}>
              {group ? `${group.project.title} · ${group.code}` : "Groep"} · {report.sheet} · <Link href={`/onderwyser/groep/${report.groupId}/${encodeURIComponent(report.sheet)}`}>maak antwoord oop</Link>
            </p>
            <form action={setAiReportStatus} style={{ display: "grid", gap: 8 }}>
              <input type="hidden" name="id" value={report.id} />
              <div className="grid-2">
                <input name="devNote" defaultValue={report.devNote ?? ""} placeholder="Interne ondersoeknota" />
                <input name="resolution" defaultValue={report.resolution ?? ""} placeholder="Wat is reggestel of besluit?" />
              </div>
              <div className="btn-row"><button className="btn sm" name="status" value="gelees">Gelees</button><button className="btn sm ok" name="status" value="verwerk">Verwerk</button></div>
            </form>
          </article>
        );
      })}

      <h2 style={{ marginTop: 28 }}>Onderwysers se terugvoer oor die KI en program</h2>
      {rows.length === 0 ? <div className="card empty">Geen onderwyserterugvoer in hierdie aansig nie.</div> : rows.map((row) => {
        const item = items.find((entry) => entry.id === row.id);
        const negativeAi = row.soort === "KI-terugvoer" && row.oordeel !== "Reg";
        return (
          <article id={`feedback-${row.id}`} className="card" key={row.id} style={row.status === "nuut" ? { borderLeft: "4px solid var(--red)", scrollMarginTop: 16 } : { scrollMarginTop: 16 }}>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <span className={`badge ${negativeAi ? "red" : "plain"}`}>{negativeAi ? "👎 KI nie reg nie" : row.soort}</span>{row.oordeel ? <span className={`badge ${RATING_TONE[row.oordeel] ?? ""}`}>{row.oordeel}</span> : null}
              <b>{row.onderwyser}</b><small className="muted">{row.datum}</small><span className="grow" />
              <span className={`badge ${row.status === "nuut" ? "red" : row.status === "verwerk" ? "ok" : "plain"}`}>{row.status}</span>
            </div>
            {row.boodskap ? <p style={{ whiteSpace: "pre-wrap", fontSize: "1.02rem" }}>{row.boodskap}</p> : null}
            {item?.issueType || item?.expectedVerdict || item?.scope ? (
              <div className="row" style={{ gap: 7 }}>
                {item.issueType ? <span className="badge plain">Rede: {ISSUE_LABEL[item.issueType] ?? item.issueType.replaceAll("_", " ")}</span> : null}
                {item.expectedVerdict ? <span className="badge plain">Verwag: {VERDICT_LABEL[item.expectedVerdict] ?? item.expectedVerdict.replaceAll("_", " ")}</span> : null}
                {item.scope ? <span className="badge plain">Omvang: {SCOPE_LABEL[item.scope] ?? item.scope}</span> : null}
              </div>
            ) : null}
            <div className="muted" style={{ fontSize: ".86rem", marginTop: 8 }}>
              {[row.projek, row.groep && `${row.groep} (${row.groepkode})`, row.werkblad, row.kriterium && `Kriterium: ${row.kriterium}`].filter(Boolean).join(" · ") || row.bladsy}
              {item?.groupId && item.sheet ? <> · <Link href={`/onderwyser/groep/${item.groupId}/${encodeURIComponent(item.sheet)}`}>maak oop</Link></> : row.bladsy ? <> · <Link href={row.bladsy}>bladsy</Link></> : null}
            </div>

            {row.ki_opsomming || row.groep_teks ? (
              <details style={{ marginTop: 10 }}>
                <summary className="muted" style={{ fontSize: ".88rem" }}>Konteks: KI-antwoord, groepteks en weergawe</summary>
                <div className="grid-2" style={{ marginTop: 10 }}>
                  <div>
                    <div className="lbl">KI ({row.ki_gereed === "ja" ? "gereed" : "nie gereed nie"})</div>
                    <p style={{ fontSize: ".9rem" }}>{row.ki_opsomming}</p>
                    {row.ki_oor_kriterium ? <p style={{ fontSize: ".9rem" }}><b>Oor “{row.kriterium}”:</b> {row.ki_oor_kriterium}</p> : null}
                    <p className="mono" style={{ fontSize: ".75rem", color: "var(--muted)" }}>{row.ki_kriteria}</p>
                    <p className="muted" style={{ fontSize: ".75rem" }}>Model: {row.ki_model || "—"} · Opdrag: {row.ki_opdragweergawe || "—"} · Werkboek: {row.werkboekweergawe || "—"}</p>
                  </div>
                  <div><div className="lbl">Groep se teks (sonder name)</div><pre style={{ whiteSpace: "pre-wrap", fontSize: ".82rem", background: "var(--paper)", padding: 10, borderRadius: 8, margin: 0, maxHeight: 320, overflow: "auto" }}>{row.groep_teks}</pre></div>
                </div>
              </details>
            ) : null}

            <form action={setDevFeedbackStatus} style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <input type="hidden" name="id" value={row.id} />
              <div className="grid-2">
                <input type="text" name="devNote" defaultValue={item?.devNote ?? ""} placeholder="Interne ontwikkelaarnota" />
                <select name="regressionStatus" defaultValue={item?.regressionStatus ?? "nie"} aria-label="Regressietoets-status">
                  <option value="nie">Nog nie ’n permanente toets nie</option><option value="beplan">Toetsgeval beplan</option><option value="bygevoeg">Toetsgeval bygevoeg</option>
                </select>
                {item?.kind === "ki" && item.criterionId ? (
                  <select name="expectedVerdict" defaultValue={item.expectedVerdict ?? ""} aria-label="Verwagte KI-oordeel">
                    <option value="">Kies verwagte oordeel</option>
                    <option value="behaal">Behaal</option>
                    <option value="gedeeltelik">Gedeeltelik</option>
                    <option value="nie_behaal">Nog nie behaal nie</option>
                  </select>
                ) : null}
              </div>
              <textarea name="developerReply" defaultValue={item?.developerReply ?? ""} rows={2} placeholder="Antwoord wat die onderwyser onder ‘My terugvoer’ sal sien" />
              <div className="btn-row">
                <button className="btn sm" name="status" value="gelees">Gelees / stoor</button>
                <button className="btn sm ok" name="status" value="verwerk">Verwerk / stoor</button>
                {item?.kind === "ki" && item.criterionId ? <button className="btn sm primary" formAction={promoteFeedbackToEval}>Maak/werk werklike KI-toets by</button> : null}
              </div>
            </form>
          </article>
        );
      })}
    </div>
  );
}
