import { runAllEvalCasesAction, runEvalCaseAction, toggleEvalCase } from "@/app/onderwyser/actions";
import { db } from "@/lib/db";
import { requireDeveloper } from "@/lib/sessie";

export const metadata = { title: "KI-toetse" };

export default async function Evaluasies() {
  const reviewer = await requireDeveloper();
  const cases = await db.aiEvalCase.findMany({ where: { schoolId: reviewer.schoolId }, orderBy: { createdAt: "desc" } });
  const passed = cases.filter((item) => item.lastPassed === true).length;
  const failed = cases.filter((item) => item.lastPassed === false).length;
  const notRun = cases.filter((item) => item.lastPassed === null).length;

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 className="grow" style={{ margin: 0 }}>Werklike KI-toetse uit terugvoer</h1>
        {cases.some((item) => item.active) ? <form action={runAllEvalCasesAction}><button className="btn primary">Loop alle aktiewe toetse</button></form> : null}
      </div>
      <p className="muted" style={{ maxWidth: "80ch" }}>
        Elke toets bevat ’n bevrore, geanonimiseerde kopie van die invoer wat die KI gesien het en die oordeel wat die onderwyser verwag. Die toets roep die werklike OpenAI-model en misluk as daardie kriterium weer verkeerd beoordeel word.
      </p>
      <div className="stats">
        <div className="stat"><div className="v">{cases.length}</div><div className="l">toetse</div></div>
        <div className="stat"><div className="v">{passed}</div><div className="l">geslaag</div></div>
        <div className={`stat ${failed ? "attn" : ""}`}><div className="v">{failed}</div><div className="l">misluk</div></div>
        <div className="stat"><div className="v">{notRun}</div><div className="l">nog nie geloop nie</div></div>
      </div>

      {cases.length === 0 ? <div className="card empty">Nog geen KI-toetse nie. Kies ’n verwagte oordeel by ’n spesifieke onderwyserkommentaar en gebruik “Maak werklike KI-toets by”.</div> : (
        <div style={{ display: "grid", gap: 12 }}>
          {cases.map((testCase) => (
            <article className="card" key={testCase.id} style={testCase.lastPassed === false ? { borderLeft: "4px solid var(--red)" } : undefined}>
              <div className="row" style={{ gap: 8 }}>
                <span className={`badge ${testCase.lastPassed === true ? "ok" : testCase.lastPassed === false ? "red" : "plain"}`}>
                  {testCase.lastPassed === true ? "Geslaag" : testCase.lastPassed === false ? "Misluk" : "Nog nie geloop"}
                </span>
                {!testCase.active ? <span className="badge plain">onaktief</span> : null}
                <b>{testCase.title}</b><span className="grow" />
                <small className="muted">deur {testCase.createdBy}</small>
              </div>
              <p><b>{testCase.criterionId}</b> moet <b>{testCase.expectedVerdict.replaceAll("_", " ")}</b> wees.</p>
              {testCase.notes ? <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{testCase.notes}</p> : null}
              {testCase.lastSummary ? <div className={`alert ${testCase.lastPassed ? "ok" : "err"}`}>{testCase.lastSummary}</div> : null}
              {testCase.lastRunAt ? <small className="muted">Laas geloop: {testCase.lastRunAt.toLocaleString("af-ZA")}</small> : null}
              <div className="btn-row" style={{ marginTop: 10 }}>
                <form action={runEvalCaseAction}><input type="hidden" name="id" value={testCase.id} /><button className="btn sm primary">Loop hierdie toets</button></form>
                <form action={toggleEvalCase}><input type="hidden" name="id" value={testCase.id} /><button className="btn sm">{testCase.active ? "Deaktiveer" : "Aktiveer"}</button></form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
