import Link from "next/link";
import { BeoordeelAlles } from "@/components/AssesseringKnoppies";
import { workbookHash, type ScoreEntry } from "@/lib/assessering/diens";
import { hasWork, photosToShow, type AssessmentResult } from "@/lib/assessering/ki";
import { rubricFor } from "@/lib/assessering/rubriek";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ki";
import { requireTeacher } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";

export const metadata = { title: "Assessering" };

export default async function AssesseringOorsig({ searchParams }: { searchParams: Promise<{ projek?: string; klas?: string }> }) {
  const t = await requireTeacher();
  const sp = await searchParams;
  const projects = await db.project.findMany({ where: { schoolId: t.schoolId, active: true }, orderBy: [{ year: "desc" }, { grade: "asc" }] });
  if (!projects.length) return <div className="container"><div className="card empty">Nog geen projekte nie.</div></div>;

  const project = projects.find((p) => p.id === sp.projek) ?? projects[0];
  const template = getTemplate(project.templateKey);
  const rubric = rubricFor(project.templateKey);
  const all = await db.group.findMany({
    where: { projectId: project.id, archived: false },
    orderBy: [{ klas: "asc" }, { name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      klas: true,
      code: true,
      members: true,
      paperImport: true,
      responses: { select: { sheet: true, data: true } },
      photos: { select: { sheet: true, size: true } },
      rubricMarks: { where: { rubricKey: rubric.key }, select: { status: true, total: true, scores: true } },
      rubricAssessments: { where: { rubricKey: rubric.key, rubricVersion: rubric.version }, orderBy: { createdAt: "desc" }, take: 1, select: { aiTotal: true, workbookHash: true, source: true, result: true } }
    }
  });
  const klasse = [...new Set(all.map((g) => g.klas).filter((k): k is string => Boolean(k)))];
  const rows = all
    .filter((g) => !sp.klas || g.klas === sp.klas)
    .map((g) => {
      const assessment = g.rubricAssessments[0] ?? null;
      const work = hasWork({ template, responses: g.responses, photos: g.photos.map((p) => ({ sheet: p.sheet, field: "", caption: null })) });
      const changed = Boolean(assessment && assessment.workbookHash !== workbookHash(g.responses));
      const current = Boolean(assessment && assessment.source !== "toetsmodus" && !changed);
      const ai = assessment?.result as unknown as AssessmentResult | undefined;
      const photosDue = work && photosToShow(g.photos).length > (current ? ai?.fotos_gesien ?? 0 : 0);
      return { g, assessment, work, current, changed, photosDue, mark: g.rubricMarks[0] ?? null, ai };
    });
  const pending = rows.filter((r) => r.work && !r.current);
  const finals = rows.filter((r) => r.mark?.status === "FINAAL");
  const qs = `projek=${project.id}`;

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 className="grow" style={{ margin: 0 }}>Assessering</h1>
        <a className="btn sm" href={`/api/assessering?${qs}`}>⬇ Punte (Excel/CSV)</a>
      </div>
      <p className="muted" style={{ maxWidth: "78ch" }}>
        {rubric.title} ({rubric.total} punte). Die KI lees elke groep se werkblad 1–14 en stel per kriterium ’n punt met motivering voor. Julle gaan daardeur en neem die finale besluit. Leerders sien niks hiervan nie.
      </p>
      {!aiConfigured() ? <div className="alert err" style={{ marginBottom: 14 }}>Geen OpenAI-sleutel nie: die KI-punte is gesimuleer (toetsmodus).</div> : null}

      <div className="tabs">
        {projects.map((p) => (
          <Link key={p.id} href={`/onderwyser/assessering?projek=${p.id}`} className={p.id === project.id ? "on" : ""}>
            {p.title} {p.year}
          </Link>
        ))}
      </div>

      <div className="stats">
        <div className="stat"><div className="v">{rows.length}</div><div className="l">groepe{sp.klas ? ` in ${sp.klas}` : ""}</div></div>
        <div className="stat"><div className="v">{rows.filter((r) => r.work).length}</div><div className="l">met ingevulde werk</div></div>
        <div className={`stat ${pending.length ? "attn" : ""}`}><div className="v">{pending.length}</div><div className="l">wag vir die KI</div></div>
        <div className="stat"><div className="v">{finals.length}</div><div className="l">finale punte gestoor</div></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <BeoordeelAlles groups={rows.filter((r) => r.work && (!r.current || r.photosDue)).map((r) => ({ id: r.g.id, name: r.g.name ?? r.g.code, pending: !r.current, photosDue: r.photosDue }))} />
      </div>

      {klasse.length > 1 ? (
        <div className="tabs">
          <Link href={`/onderwyser/assessering?${qs}`} className={!sp.klas ? "on" : ""}>Alle klasse</Link>
          {klasse.map((k) => (
            <Link key={k} href={`/onderwyser/assessering?${qs}&klas=${encodeURIComponent(k)}`} className={sp.klas === k ? "on" : ""}>{k}</Link>
          ))}
        </div>
      ) : null}

      {rows.length ? (
        <div className="dtable-wrap">
          <table className="dtable">
            <thead>
              <tr>
                <th>Groep</th>
                <th>Klas</th>
                {rubric.criteria.map((c) => <th key={c.id} title={c.title} style={{ textAlign: "center" }}>K{c.number}</th>)}
                <th>KI</th>
                <th>Finaal</th>
                <th>Stand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ g, assessment, work, changed, mark, ai }) => {
                const scores = (mark?.scores ?? {}) as Record<string, ScoreEntry>;
                return (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/onderwyser/assessering/${g.id}`}><b>{g.name ?? "(nog geen naam)"}</b></Link>
                      <div className="muted" style={{ fontSize: ".8rem" }}>
                        {(Array.isArray(g.members) ? (g.members as string[]) : []).filter(Boolean).join(", ") || "—"} · <span className="mono">{g.code}</span>
                        {g.paperImport ? " · papier" : ""}
                        {ai?.fotos_gesien ? ` · KI het ${ai.fotos_gesien} foto’s gesien` : ""}
                      </div>
                    </td>
                    <td>{g.klas ?? "—"}</td>
                    {rubric.criteria.map((c) => {
                      const mine = scores[c.id]?.punt;
                      const fromAi = ai?.kriteria.find((k) => k.id === c.id)?.punt;
                      return (
                        <td key={c.id} style={{ textAlign: "center" }} className={mine === undefined ? "muted" : undefined}>
                          {mine !== undefined ? <b>{mine}</b> : fromAi ?? "–"}
                        </td>
                      );
                    })}
                    <td>{assessment ? `${assessment.aiTotal}/50` : "–"}</td>
                    <td>{mark ? <b>{mark.total}/50</b> : "–"}</td>
                    <td>
                      {mark?.status === "FINAAL" ? (
                        <span className="badge ok">Finaal</span>
                      ) : mark ? (
                        <span className="badge warn">Konsep</span>
                      ) : !work ? (
                        <span className="badge plain">Niks ingevul</span>
                      ) : changed ? (
                        <span className="badge warn">Werkboek het verander</span>
                      ) : assessment ? (
                        <span className="badge wait">Wag vir julle</span>
                      ) : (
                        <span className="badge">Wag vir KI</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty">Geen groepe in hierdie projek nie.</div>
      )}
      <p className="muted" style={{ fontSize: ".82rem", marginTop: 10 }}>Vet punte by K1–K5 is julle eie; grys is die KI se voorstel.</p>
    </div>
  );
}
