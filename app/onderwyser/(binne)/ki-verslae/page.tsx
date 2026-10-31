import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/sessie";
import { AI_REPORT_LABELS } from "@/lib/terugvoer-beheer";

export const metadata = { title: "KI-verslae" };

export default async function KiVerslae() {
  const teacher = await requireTeacher();
  const reports = await db.aiReport.findMany({ where: { schoolId: teacher.schoolId }, orderBy: { createdAt: "desc" }, take: 200 });
  const groups = await db.group.findMany({
    where: { id: { in: [...new Set(reports.map((report) => report.groupId))] } },
    include: { project: true }
  });

  return (
    <div className="container narrow">
      <h2>Leerders oor die KI</h2>
      <p className="muted">Wanneer ’n groep ’n KI-antwoord as verkeerd, onveilig of onvanpas rapporteer, verskyn dit hier vir die onderwyser.</p>
      {reports.length === 0 ? <div className="card empty">Nog geen KI-antwoorde is deur groepe gerapporteer nie.</div> : (
        <div style={{ display: "grid", gap: 12 }}>
          {reports.map((report) => {
            const group = groups.find((item) => item.id === report.groupId);
            return (
              <article className="card" key={report.id} style={report.status === "nuut" ? { borderLeft: "4px solid var(--red)" } : undefined}>
                <div className="row" style={{ gap: 8 }}>
                  <span className={`badge ${report.status === "verwerk" ? "ok" : report.status === "nuut" ? "red" : "plain"}`}>{report.status}</span>
                  <b>{AI_REPORT_LABELS[report.category as keyof typeof AI_REPORT_LABELS] ?? report.category}</b>
                  <small className="muted">{report.createdAt.toLocaleString("af-ZA")}</small>
                </div>
                {report.message ? <p style={{ whiteSpace: "pre-wrap" }}>{report.message}</p> : null}
                <p className="muted" style={{ fontSize: ".86rem" }}>
                  {group ? `${group.project.title} · ${group.code}` : "Groep"} · {report.sheet} · <Link href={`/onderwyser/groep/${report.groupId}/${encodeURIComponent(report.sheet)}`}>lees die werk en KI-antwoord</Link>
                </p>
                {report.resolution ? <div className="teacher-note"><b>Uitkoms van die ondersoek</b><p style={{ marginBottom: 0 }}>{report.resolution}</p></div> : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
