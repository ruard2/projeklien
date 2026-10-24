import Link from "next/link";
import { redirect } from "next/navigation";
import VoorNa from "@/components/VoorNa";
import Herlaai from "@/components/Herlaai";
import { asResults, beforeAfter } from "@/lib/pdf-vergelyking/diens";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/sessie";
import { getTemplate } from "@/lib/werkboeke/sjablone";
import { STATUS_LABEL } from "@/lib/pdf-vergelyking/status";
import { paperGroupName, paperIdentity } from "@/lib/pdf-vergelyking/papier";
import type { Extracted } from "@/lib/pdf-vergelyking/skema";

export const metadata = { title: "KI beoordeel" };


export default async function PdfVergelyking({ searchParams }: { searchParams: Promise<{ groep?: string }> }) {
  const t = await requireTeacher();
  const { groep } = await searchParams;
  if (groep) redirect(`/onderwyser/ontwikkel?groep=${encodeURIComponent(groep)}`);
  const [items] = await Promise.all([
    db.pdfComparison.findMany({
      where: { schoolId: t.schoolId, ...(t.role === "TEACHER" ? { teacherId: t.id } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, createdAt: true, fileName: true, status: true, templateKey: true, teacherName: true, extracted: true, results: true, groupId: true, model: true }
    })
  ]);
  // Dieselfde werkboek meer as een keer ingelees: wys net die hoofweergawe prominent.
  const primary = new Map<string, string>();
  for (const c of [...items].sort((a, b) => (a.groupId ? -1 : 0) - (b.groupId ? -1 : 0) || (b.model?.startsWith("handmatig") ? 1 : 0) - (a.model?.startsWith("handmatig") ? 1 : 0) || b.createdAt.getTime() - a.createdAt.getTime())) {
    if (!c.extracted) continue;
    const k = paperIdentity(c.templateKey, c.extracted as Extracted);
    if (!primary.has(k)) primary.set(k, c.id);
  }
  const isDuplicate = (c: (typeof items)[number]) => Boolean(c.extracted) && primary.get(paperIdentity(c.templateKey, c.extracted as Extracted)) !== c.id;
  const rows = [...items.filter((c) => !isDuplicate(c)), ...items.filter(isDuplicate)];

  return (
    <div className="container">
      <div className="crumb"><Link href="/onderwyser/ki">KI oplei</Link></div>
      <h1>KI beoordeel</h1>
      <p className="muted" style={{ maxWidth: "80ch" }}>
        Per nagesiene werkboek sien jy jou eie kommentaar langs dié van die KI. Gee 👍 of 👎 per kriterium; by ’n 👎 praat jy met die KI en word ’n reël voorgestel wat dadelik geld.
      </p>

      {(() => {
        const ba = beforeAfter(items.map((c) => asResults(c.results)));
        const busy = items.filter((c) => c.status === "ki" || c.status === "uitlees").length;
        if (ba.sheets === 0 && !busy) return null;
        return (
          <div className="card" style={{ marginTop: 18 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <h2 className="grow" style={{ margin: 0 }}>Werk die reëls?</h2>
            </div>
            {busy ? <Herlaai seconds={10} /> : null}
            {busy ? <p className="muted" style={{ marginBottom: 0 }}><span className="spinner dark" /> {busy} vergelyking(s) word tans deur die KI beoordeel… herlaai die bladsy oor ’n paar minute.</p> : null}
            {ba.sheets > 0 ? <VoorNa ba={ba} /> : <p className="muted" style={{ marginBottom: 0 }}>Beoordeel die vergelykings weer nadat reëls bygevoeg is; dan sien jy hier hoeveel meer die KI met die juf saamstem.</p>}
          </div>
        );
      })()}


      <div className="card" style={{ marginTop: 18 }}>
        <h2>Nagesiene werkboeke</h2>
        {items.length === 0 ? (
          <p className="muted">Nog niks nie. (Werkboeke word tydelik via <Link href="/onderwyser/ontwikkel">Ontwikkelfunksies</Link> ingelees.)</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dtable">
              <thead>
                <tr><th>Datum</th><th>Werkboek</th><th>Groep</th><th>Status</th>{t.role !== "TEACHER" ? <th>Deur</th> : null}</tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const e = c.extracted as Extracted | null;
                  const dup = isDuplicate(c);
                  const st = STATUS_LABEL[c.status] ?? { text: c.status, cls: "plain" };
                  return (
                    <tr key={c.id} style={dup ? { opacity: 0.55 } : undefined}>
                      <td><Link href={`/onderwyser/pdf-vergelyking/${c.id}`}>{c.createdAt.toLocaleString("af-ZA", { dateStyle: "medium", timeStyle: "short" })}</Link></td>
                      <td>{getTemplate(c.templateKey).label}</td>
                      <td><b>{e ? paperGroupName(e) : "—"}</b>{e?.klas ? ` · ${e.klas}` : ""}{dup ? <><br /><small className="muted">ouer/dubbele inlees</small></> : null}</td>
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
