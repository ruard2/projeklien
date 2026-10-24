import Link from "next/link";
import PdfInvoer from "@/components/PdfInvoer";
import VoorNa from "@/components/VoorNa";
import Herlaai from "@/components/Herlaai";
import { makeAllGroupsAction, rerunEverythingAction } from "@/app/onderwyser/pdf-aksies";
import { paperGroupName } from "@/lib/pdf-vergelyking/papier";
import { asResults, beforeAfter } from "@/lib/pdf-vergelyking/diens";
import PdfOplaai from "@/components/PdfOplaai";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ki";
import { requireTeacher } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";
import { STATUS_LABEL } from "@/lib/pdf-vergelyking/status";

export const metadata = { title: "PDF-vergelyking" };


export default async function PdfVergelyking({ searchParams }: { searchParams: Promise<{ groep?: string }> }) {
  const t = await requireTeacher();
  const { groep } = await searchParams;
  const group = groep
    ? await db.group.findFirst({ where: { id: groep, project: { schoolId: t.schoolId } }, select: { id: true, name: true, klas: true, code: true, projectId: true } })
    : null;
  const [projects, items] = await Promise.all([
    db.project.findMany({ where: { schoolId: t.schoolId, active: true }, orderBy: [{ grade: "asc" }, { title: "asc" }] }),
    db.pdfComparison.findMany({
      where: { schoolId: t.schoolId, ...(t.role === "TEACHER" ? { teacherId: t.id } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, createdAt: true, fileName: true, status: true, templateKey: true, teacherName: true, extracted: true, results: true, groupId: true }
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
  const canMake = items.filter((c) => !c.groupId && c.extracted && ["nagaan", "ki", "klaar"].includes(c.status));

  return (
    <div className="container">
      <h1>PDF-vergelyking</h1>
      <p className="muted" style={{ maxWidth: "80ch" }}>
        Laai ’n gescande, nagesiene papierwerkboek op. Die KI lees die leerders se antwoorde en jou kommentaar apart uit. Nadat jy die uitlees goedgekeur het, kry die leerders se werk die gewone KI-terugvoer, en sien jy per werkblad jou kommentaar langs dié van die KI. Met 👍/👎 help jy om die KI beter te maak.
      </p>

      <div className="card">
        <h2>{group ? "Papierwerkboek vir hierdie groep oplaai" : "Nuwe werkboek oplaai"}</h2>
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

      {!group ? (
        <details className="pv-acc">
          <summary><span className="t">📥 Voer ’n lêer met uitgelese werkboeke in (JSON)</span></summary>
          <div className="body"><PdfInvoer /></div>
        </details>
      ) : null}

      {(() => {
        const ba = beforeAfter(items.map((c) => asResults(c.results)));
        const admin = t.role !== "TEACHER";
        const busy = items.filter((c) => c.status === "ki" || c.status === "uitlees").length;
        if (!admin && ba.sheets === 0) return null;
        return (
          <div className="card" style={{ marginTop: 18 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <h2 className="grow" style={{ margin: 0 }}>Werk die reëls?</h2>
              {admin ? (
                <form action={rerunEverythingAction}>
                  <button className="btn sm" disabled={busy > 0}>🔄 Beoordeel alle vergelykings weer</button>
                </form>
              ) : null}
            </div>
            {busy ? <Herlaai seconds={10} /> : null}
            {busy ? <p className="muted" style={{ marginBottom: 0 }}><span className="spinner dark" /> {busy} vergelyking(s) word tans deur die KI beoordeel… herlaai die bladsy oor ’n paar minute.</p> : null}
            {ba.sheets > 0 ? <VoorNa ba={ba} /> : <p className="muted" style={{ marginBottom: 0 }}>Beoordeel die vergelykings weer nadat reëls bygevoeg is; dan sien jy hier hoeveel meer die KI met die juf saamstem.</p>}
          </div>
        );
      })()}


      {paperGroups.length || canMake.length ? (
        <div className="card" id="digitaal" style={{ marginTop: 18 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <h2 className="grow" style={{ margin: 0 }}>📱 Digitale werkboeke vir die leerders</h2>
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
            <p className="muted" style={{ fontSize: ".9rem" }}>Nog te maak: {canMake.map((c) => paperGroupName(c.extracted as never)).join(", ")}</p>
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

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Vorige oplaaie</h2>
        {items.length === 0 ? (
          <p className="muted">Nog niks opgelaai nie.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dtable">
              <thead>
                <tr><th>Datum</th><th>Werkboek</th><th>Groep</th><th>Status</th>{t.role !== "TEACHER" ? <th>Deur</th> : null}</tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const e = c.extracted as { klas?: string; groepnaam?: string } | null;
                  const st = STATUS_LABEL[c.status] ?? { text: c.status, cls: "plain" };
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/onderwyser/pdf-vergelyking/${c.id}`}>{c.createdAt.toLocaleString("af-ZA", { dateStyle: "medium", timeStyle: "short" })}</Link></td>
                      <td>{getTemplate(c.templateKey).label}<br /><small className="muted">{c.fileName}</small></td>
                      <td>{[e?.groepnaam, e?.klas].filter(Boolean).join(" · ") || "—"}</td>
                      <td><span className={`badge ${st.cls}`}>{st.text}</span></td>
                      {t.role !== "TEACHER" ? <td>{c.teacherName}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
