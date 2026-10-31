import BeheerTabs from "@/components/BeheerTabs";
import AksieVorm from "@/components/AksieVorm";
import { changeOwnPassword, changeTeacherRole, createProject, createTeacher, toggleProject, toggleTeacher } from "@/app/onderwyser/actions";
import { aiConfigured, aiModel } from "@/lib/ki";
import { storageDriver } from "@/lib/berging";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/sessie";
import { listTemplates } from "@/lib/werkboeke/sjablone";

export const metadata = { title: "Bestuur" };

export default async function Beheer() {
  const a = await requireAdmin();
  const [projects, teachers, newFeedbackCount, newNegativeAiCount] = await Promise.all([
    db.project.findMany({ where: { schoolId: a.schoolId }, orderBy: [{ year: "desc" }, { grade: "asc" }], include: { _count: { select: { groups: true } } } }),
    db.teacher.findMany({ where: { schoolId: a.schoolId }, orderBy: { name: "asc" } }),
    db.devFeedback.count({ where: { schoolId: a.schoolId, status: "nuut" } }),
    db.devFeedback.count({ where: { schoolId: a.schoolId, status: "nuut", kind: "ki", NOT: { rating: "reg" } } })
  ]);
  const templates = listTemplates();

  return (
    <div className="container">
      <h1 style={{ marginBottom: 8 }}>⚙️ Beheer</h1>
      <BeheerTabs on="bestuur" />

      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="stat">
          <div className="v" style={{ fontSize: "1.1rem" }}>{aiConfigured() ? aiModel() : "Toetsmodus"}</div>
          <div className="l">KI-terugvoer {aiConfigured() ? "(OpenAI)" : "– geen OPENAI_API_KEY nie"}</div>
        </div>
        <div className="stat">
          <div className="v" style={{ fontSize: "1.1rem" }}>{storageDriver() === "s3" ? "S3-bucket" : "Databasis"}</div>
          <div className="l">Foto-berging</div>
        </div>
        <div className="stat">
          <div className="v" style={{ fontSize: "1.1rem" }}>{a.school.name}</div>
          <div className="l">Skool</div>
        </div>
        <a className={`stat ${newFeedbackCount ? "attn" : ""}`} href="/onderwyser/terugvoer?status=nuut" style={{ color: "inherit", textDecoration: "none" }}>
          <div className="v">{newFeedbackCount}</div>
          <div className="l">nuwe terugvoer · {newNegativeAiCount} KI-probleme · maak oop →</div>
        </a>
      </div>

      <div className="layout-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h2>Projekte</h2>
          <div className="dtable-wrap" style={{ boxShadow: "none", marginBottom: 18 }}>
            <table className="dtable">
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>
                        {p.title} {p.year}
                      </b>
                      <div className="muted" style={{ fontSize: ".8rem" }}>
                        {p._count.groups} groepe · <span className="mono">{p.templateKey}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <form action={toggleProject}>
                        <input type="hidden" name="projectId" value={p.id} />
                        <button className="btn sm">{p.active ? "Deaktiveer" : "Aktiveer"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Nuwe projek</h3>
          <AksieVorm action={createProject} submit="Skep projek">
            <div className="grid-2">
              <div>
                <label className="lbl">Werkboek</label>
                <select name="templateKey">
                  {templates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl">Jaar</label>
                <input type="number" name="year" defaultValue={new Date().getFullYear()} />
              </div>
            </div>
            <div>
              <label className="lbl">Titel (opsioneel)</label>
              <input type="text" name="title" placeholder="bv. Graad 9 · Haweloosheid" />
            </div>
          </AksieVorm>
        </div>

        <div className="card">
          <h2>Onderwysers</h2>
          <div className="dtable-wrap" style={{ boxShadow: "none", marginBottom: 18 }}>
            <table className="dtable">
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b>{t.name}</b>{" "}
                      {t.role === "DEVELOPER" ? <span className="badge plain blue">ontwikkelaar</span> : t.role === "ADMIN" ? <span className="badge plain blue">admin</span> : null}
                      <div className="muted" style={{ fontSize: ".8rem" }}>
                        {t.email}
                        {!t.active ? " · gedeaktiveer" : ""}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {t.id !== a.id ? (
                        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                          <form action={changeTeacherRole} className="row" style={{ gap: 5 }}>
                            <input type="hidden" name="teacherId" value={t.id} />
                            <select name="role" defaultValue={t.role} aria-label={`Rol vir ${t.name}`} style={{ minWidth: 130 }}>
                              <option value="TEACHER">Onderwyser</option>
                              <option value="ADMIN">Administrateur</option>
                              <option value="DEVELOPER">Ontwikkelaar</option>
                            </select>
                            <button className="btn sm">Stoor rol</button>
                          </form>
                          <form action={toggleTeacher}>
                            <input type="hidden" name="teacherId" value={t.id} />
                            <button className="btn sm">{t.active ? "Deaktiveer" : "Aktiveer"}</button>
                          </form>
                        </div>
                      ) : (
                        <small>jy</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Voeg ’n onderwyser by</h3>
          <AksieVorm action={createTeacher} submit="Voeg by">
            <div className="grid-2">
              <div>
                <label className="lbl">Naam</label>
                <input type="text" name="name" placeholder="bv. Mev. Van der Merwe" required />
              </div>
              <div>
                <label className="lbl">E-pos</label>
                <input type="email" name="email" required />
              </div>
              <div>
                <label className="lbl">Tydelike wagwoord</label>
                <input type="text" name="password" minLength={8} required />
              </div>
              <div>
                <label className="lbl">Rol</label>
                <select name="role">
                  <option value="TEACHER">Onderwyser</option>
                  <option value="ADMIN">Administrateur</option>
                  <option value="DEVELOPER">Ontwikkelaar</option>
                </select>
              </div>
            </div>
          </AksieVorm>
          <hr className="sep" />
          <h3>My wagwoord</h3>
          <AksieVorm action={changeOwnPassword} submit="Verander wagwoord" variant="plain">
            <input type="password" name="password" minLength={8} placeholder="Nuwe wagwoord" required autoComplete="new-password" />
          </AksieVorm>
        </div>
      </div>
    </div>
  );
}
