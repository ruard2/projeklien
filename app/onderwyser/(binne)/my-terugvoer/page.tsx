import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/sessie";
import { RATING_LABEL } from "@/lib/terugvoer-uitvoer";

export const metadata = { title: "My terugvoer" };

const STATUS_LABEL: Record<string, string> = { nuut: "Ontvang", gelees: "Word ondersoek", verwerk: "Verwerk" };

export default async function MyTerugvoer() {
  const teacher = await requireTeacher();
  const items = await db.devFeedback.findMany({ where: { teacherId: teacher.id }, orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="container narrow">
      <h2>My terugvoer aan die ontwikkelaar</h2>
      <p className="muted">Hier sien jy wat jy oor die program of KI gestuur het, die verwerkingstatus en die ontwikkelaar se antwoord.</p>
      {items.length === 0 ? (
        <div className="card empty">Jy het nog geen terugvoer gestuur nie. Gebruik die rooi klets-knoppie regs onder.</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {items.map((item) => (
            <article className="card" key={item.id}>
              <div className="row" style={{ gap: 8 }}>
                <span className={`badge ${item.status === "verwerk" ? "ok" : item.status === "gelees" ? "warn" : "plain"}`}>{STATUS_LABEL[item.status] ?? item.status}</span>
                <b>{item.kind === "ki" ? "KI-terugvoer" : "Algemene terugvoer"}</b>
                {item.rating ? <span className="badge plain">{RATING_LABEL[item.rating] ?? item.rating}</span> : null}
                <small className="muted">{item.createdAt.toLocaleString("af-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
              </div>
              {item.message ? <p style={{ whiteSpace: "pre-wrap" }}>{item.message}</p> : null}
              {item.developerReply ? (
                <div className="teacher-note">
                  <b>Antwoord van die ontwikkelaar</b>
                  <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{item.developerReply}</p>
                  {item.respondedAt ? <div className="by">{item.respondedAt.toLocaleDateString("af-ZA")}</div> : null}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: ".88rem" }}>Nog geen antwoord van die ontwikkelaar nie.</p>
              )}
              {item.page ? <Link href={item.page}>Maak die betrokke bladsy oop</Link> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
