import Link from "next/link";
import PdfInvoer from "@/components/PdfInvoer";
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
      select: { id: true, createdAt: true, fileName: true, status: true, templateKey: true, teacherName: true, extracted: true }
    })
  ]);

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
