import Link from "next/link";
import Herlaai from "@/components/Herlaai";
import PdfInvoer from "@/components/PdfInvoer";
import PdfOplaai from "@/components/PdfOplaai";
import ReelInvoer from "@/components/ReelInvoer";
import { makeAllGroupsAction, rerunEverythingAction } from "@/app/onderwyser/pdf-aksies";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ki";
import { paperGroupName, pickPaperCandidates } from "@/lib/pdf-vergelyking/papier";
import { isAdminRole, requireDeveloper } from "@/lib/sessie";

export const metadata = { title: "Ontwikkelfunksies" };

export default async function Ontwikkel({ searchParams }: { searchParams: Promise<{ groep?: string }> }) {
  const t = await requireDeveloper();
  const admin = isAdminRole(t.role);
  const { groep } = await searchParams;
  const group = groep
    ? await db.group.findFirst({ where: { id: groep, project: { schoolId: t.schoolId } }, select: { id: true, name: true, klas: true, code: true, projectId: true } })
    : null;
  const [projects, items] = await Promise.all([
    db.project.findMany({ where: { schoolId: t.schoolId, active: true }, orderBy: [{ grade: "asc" }, { title: "asc" }] }),
    db.pdfComparison.findMany({
      where: { schoolId: t.schoolId, ...(t.role === "TEACHER" ? { teacherId: t.id } : {}) },
      select: { id: true, createdAt: true, status: true, templateKey: true, extracted: true, groupId: true, model: true }
    })
  ]);
  const linkedIds = items.map((c) => c.groupId).filter((x): x is string => Boolean(x));
  const paperGroups = linkedIds.length
    ? await db.group.findMany({
        where: { id: { in: linkedIds }, paperImport: true },
        select: { id: true, code: true, name: true, klas: true, members: true, _count: { select: { feedback: true, responses: true } } },
        orderBy: { createdAt: "asc" }
      })
    : [];
  const { picks: canMake, duplicates } = pickPaperCandidates(items, new Set(paperGroups.map((g) => g.id)));
  const busy = items.filter((c) => c.status === "ki" || c.status === "uitlees").length;

  return (
    <div className="container">
      <h1>🧪 Ontwikkelfunksies</h1>
      <div className="dev-banner">
        Net vir die ontwikkelaar: papierwerkboeke inlees, die KI toets en terugvoer verwerk. Onderwysers sien dit nie (sodra daar ’n eie ontwikkelaarsrekening is). Die gewone werk gebeur by <Link href="/onderwyser">Groepe</Link> en <Link href="/onderwyser/ki-reels">KI-reëls</Link>.
      </div>
      <div className="hub">
        <Link href="/onderwyser/pdf-vergelyking"><b>⚖️ KI beoordeel (papier)</b><span>Juf se papierkommentaar langs die KI, 👍/👎 en voor/ná.</span></Link>
        <Link href="/onderwyser/terugvoer"><b>💬 Ontwikkelaarsinkassie</b><span>Terugvoer van onderwysers en verslae van leerders verwerk en beantwoord.</span></Link>
        <Link href="/onderwyser/evaluasies"><b>🧪 KI-toetse</b><span>Regressietoetse uit werklike gevalle.</span></Link>
      </div>

      {paperGroups.length || canMake.length ? (
        <div className="card" id="digitaal">
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <h2 className="grow" style={{ margin: 0 }}>📱 Digitale werkboeke uit papierwerkboeke</h2>
            {canMake.length ? (
              <form action={makeAllGroupsAction}>
                <button className="btn sm">Maak {canMake.length} digitale werkboek(e)</button>
              </form>
            ) : null}
          </div>
          <p className="muted">
            Die leerders se papierwerk word hul groep se werk in die app. Werkblaaie wat op papier afgeteken is, tel as afgeteken (die volgende werkblad gaan oop), maar die groep mag dit nog verbeter. By elke werkblad sien hulle jou papierkommentaar en vars KI-terugvoer met al die reëls. Gee elke groep sy kode om mee aan te meld.
          </p>
          {canMake.length ? (
            <p className="muted" style={{ fontSize: ".9rem" }}>Nog te maak: {canMake.map((c) => paperGroupName(c.extracted as never)).join(", ")}{duplicates ? ` · ${duplicates} dubbele oplaai(e) word oorgeslaan (die handmatige invoer of die nuutste weergawe word gebruik)` : ""}</p>
          ) : null}
          {paperGroups.some((g) => g._count.feedback < g._count.responses - 1) ? <Herlaai seconds={15} /> : null}
          {paperGroups.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="dtable">
                <thead><tr><th>Groep</th><th>Klas</th><th>Lede</th><th>Kode</th><th>KI-terugvoer</th></tr></thead>
                <tbody>
                  {paperGroups.map((g) => {
                    const total = g._count.responses - 1;
                    const done = g._count.feedback;
                    return (
                      <tr key={g.id}>
                        <td><Link href={`/onderwyser/groep/${g.id}`}>{g.name}</Link></td>
                        <td>{g.klas ?? "—"}</td>
                        <td><small>{(Array.isArray(g.members) ? (g.members as string[]) : []).filter(Boolean).join(", ")}</small></td>
                        <td><code style={{ fontSize: "1rem", fontWeight: 700 }}>{g.code}</code></td>
                        <td>{done >= total ? "✓ klaar" : <><span className="spinner dark" /> {done}/{total}</>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}


      <details className="pv-acc" open={Boolean(group)} style={{ marginTop: 18 }}>
        <summary><span className="t">📄 Papierwerkboek oplaai (PDF){group ? ` · vir groep ${group.name ?? group.code}` : ""}</span></summary>
        <div className="body">
          {!aiConfigured() ? (
            <div className="alert err">Die KI is nie op hierdie bediener opgestel nie (OPENAI_API_KEY ontbreek).</div>
          ) : projects.length === 0 ? (
            <div className="alert info">Daar is nog geen aktiewe projek nie.</div>
          ) : (
            <PdfOplaai
              projects={projects.map((p) => ({ id: p.id, grade: p.grade, title: p.phenomenon, sub: `${p.title} · ${p.year}` }))}
              group={group ? { id: group.id, projectId: group.projectId, label: `Vir groep ${[group.name, group.klas ? `klas ${group.klas}` : null, group.code].filter(Boolean).join(" · ")}` } : undefined}
            />
          )}
        </div>
      </details>

      <details className="pv-acc">
        <summary><span className="t">📥 Uitgelese werkboeke invoer (JSON)</span></summary>
        <div className="body"><PdfInvoer /></div>
      </details>

      {admin ? (
        <>
          <details className="pv-acc">
            <summary><span className="t">📏 KI-reëls invoer (JSON)</span></summary>
            <div className="body"><ReelInvoer /></div>
          </details>

          <details className="pv-acc">
            <summary><span className="t">🔄 Alle vergelykings weer deur die KI laat beoordeel</span></summary>
            <div className="body">
              {busy ? <Herlaai seconds={10} /> : null}
              <p className="muted" style={{ marginTop: 0 }}>Met die huidige reëls. Die voor/ná-uitslag verskyn by <Link href="/onderwyser/pdf-vergelyking">KI beoordeel</Link>.</p>
              {busy ? <p><span className="spinner dark" /> {busy} vergelyking(s) word tans beoordeel…</p> : null}
              <form action={rerunEverythingAction}>
                <button className="btn sm" disabled={busy > 0}>🔄 Beoordeel alles weer</button>
              </form>
            </div>
          </details>

          <details className="pv-acc">
            <summary><span className="t">⬇ Alles aflaai vir ontleding (JSON)</span></summary>
            <div className="body">
              <p className="muted" style={{ marginTop: 0 }}>Reëls, reëlgeskiedenis, vergelykings, 👍/👎 en gesprekke, sonder leerdername.</p>
              <a className="btn sm" href="/api/oudit/uitvoer" download>⬇ Laai af</a>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
